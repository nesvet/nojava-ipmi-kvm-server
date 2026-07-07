import asyncio
import json
import logging
import os

try:
    from typing import List, Optional
except ImportError:
    pass

from tornado import ioloop
from tornado.websocket import WebSocketClosedError

from nojava_ipmi_kvm.kvm import (
    start_kvm_container,
    WebserverNotReachableError,
    DockerNotInstalledError,
    DockerNotCallableError,
    DockerPortNotReadableError,
    DockerTerminatedError,
    KvmDownloadFailedError,
    KvmLoginFailedError,
    KvmStartupTimeoutError,
    HTML5KvmViewer,
    JavaKvmViewer,
)
from nojava_ipmi_kvm.config import config, HTML5HostConfig
from nojava_ipmi_kvm import utils

from basehandler import BaseWSHandler

WEB_PORT_START = int(os.environ.get("WEB_PORT_START", 8800))
WEB_PORT_END = int(os.environ.get("WEB_PORT_END", 8900))
external_web_dns = os.environ.get("EXTERNAL_WEB_DNS", "localhost")
HTML5_AUTHORIZATION = os.environ.get("HTML5_AUTHORIZATION", "disabled")
JAVA_IFRAME_PATH_FORMAT = os.environ.get("JAVA_IFRAME_PATH_FORMAT", "{url}")
HTML5_IFRAME_PATH_FORMAT = os.environ.get("HTML5_IFRAME_PATH_FORMAT", "{url}")
HTML5_SUBDIR_FORMAT = os.environ.get("HTML5_SUBDIR_FORMAT", "")

logging.basicConfig(level=os.environ.get("LOGLEVEL", "INFO"))

used_ports: List[int] = []


def _error_code_for_exception(ex):
    if isinstance(ex, KvmLoginFailedError):
        return "bmc_auth"
    if isinstance(ex, KvmDownloadFailedError):
        return "bmc_download"
    if isinstance(ex, WebserverNotReachableError):
        return "bmc_unreachable"
    if isinstance(ex, KvmStartupTimeoutError):
        return "startup_timeout"
    return None


class KVMHandler(BaseWSHandler):
    def open(self):
        self._current_session = None
        self._web_port = 0
        self._current_user = self.get_current_user()
        self._connecting = False
        self._is_closed = False
        self._connect_task = None

        if self._current_user is None or not self._current_user["is_admin"]:
            return self.close(code=401, reason="Unauthorized")

        logging.info("Websocket opened by %s", self._current_user["name"])

    def _safe_write(self, message):
        if self._is_closed:
            return False
        try:
            self.write_message(message)
            return True
        except WebSocketClosedError:
            self._is_closed = True
            return False

    def _schedule_write(self, message):
        if self._is_closed:
            return
        ioloop.IOLoop.current().add_callback(self._safe_write, message)

    def _send_log(self, msg, *args, **kwargs):
        self._schedule_write({"action": "log", "message": msg if len(args) == 0 else msg % args})

    def _release_web_port(self, web_port):
        if web_port in used_ports:
            used_ports.remove(web_port)

    async def on_message(self, msg):
        logging.info("Websocket from %s said %s", self._current_user["name"], msg)

        try:
            msg = json.loads(msg)
        except json.decoder.JSONDecodeError:
            return self._safe_write({"action": "notice", "message": "Invalid json received"})

        if "action" in msg:
            if msg["action"] == "connect":
                if self._connecting or (
                    self._connect_task is not None and not self._connect_task.done()
                ):
                    return self._safe_write({"action": "notice", "message": "Already connected to a kvm!"})
                self._connect_task = asyncio.create_task(self._handle_connect(msg))
                return

        self._safe_write(
            {"action": "notice", "message": "Invalid msg received", "source": msg, "user": self.get_current_user()}
        )

    async def _handle_connect(self, msg):
        web_port = None
        self._connecting = True
        try:
            server = msg["server"]
            password = msg["password"]
            resolution = msg["resolution"] if "resolution" in msg else None
            logging.info("%s wants to connect to %s with res %s", self._current_user["name"], server, resolution)

            if server not in config.get_servers():
                return self._safe_write(
                    {"action": "notice", "message": "The specified hostname is not valid.", "refresh": True}
                )
            host_config = config[server]

            for p in range(WEB_PORT_START, WEB_PORT_END):
                if p not in used_ports:
                    self._web_port = p
                    web_port = p
                    used_ports.append(p)
                    break
            else:
                return self._safe_write(
                    {
                        "action": "notice",
                        "message": "No unused port available. Please notify admins.",
                        "refresh": True,
                    }
                )

            authorization_key = None
            authorization_value = None
            if isinstance(host_config, HTML5HostConfig):
                if HTML5_AUTHORIZATION == "generate":
                    authorization_key = "kvm_auth_" + str(self._web_port)
                    authorization_value = utils.generate_temp_password(20)
                elif HTML5_AUTHORIZATION == "use_server":
                    authorization_key = "is_admin"
                    authorization_value = self.get_cookie("is_admin")
                elif ":" in HTML5_AUTHORIZATION:
                    authorization_key = HTML5_AUTHORIZATION.split(":")[0]
                    authorization_value = HTML5_AUTHORIZATION.split(":", 1)[1]

            sess = self._current_session = await start_kvm_container(
                host_config=host_config,
                login_password=password,
                external_vnc_dns=external_web_dns,
                docker_port=self._web_port,
                additional_logging=self._send_log,
                selected_resolution=resolution,
                authorization_key=authorization_key,
                authorization_value=authorization_value,
                subdir=HTML5_SUBDIR_FORMAT.format(
                    external_web_dns=external_web_dns, port=self._web_port, hostname=host_config.full_hostname
                ),
            )
        except asyncio.CancelledError:
            if self._current_session is not None:
                self._release_web_port(self._web_port)
                self._current_session.kill_process()
                self._current_session = None
            elif web_port is not None:
                self._release_web_port(web_port)
            raise
        except (
            WebserverNotReachableError,
            DockerNotInstalledError,
            DockerNotCallableError,
            IOError,
            DockerTerminatedError,
            DockerPortNotReadableError,
            KvmStartupTimeoutError,
        ) as ex:
            logging.exception("Could not start KVM container")
            if web_port is not None:
                self._release_web_port(web_port)
            payload = {"action": "error", "message": str(ex)}
            error_code = _error_code_for_exception(ex)
            if error_code is not None:
                payload["code"] = error_code
            return self._safe_write(payload)
        finally:
            self._connecting = False

        if self._is_closed:
            logging.warning("WebSocket closed before KVM connect completed; skipping connected message")
            return

        if isinstance(sess, HTML5KvmViewer):
            if not self._safe_write(
                {
                    "action": "connected",
                    "url": HTML5_IFRAME_PATH_FORMAT.format(
                        url=sess.url,
                        external_web_dns=external_web_dns,
                        port=sess.web_port,
                        subdir=sess.subdir,
                        authorization_key=sess.authorization_key,
                        authorization_value=sess.authorization_value,
                        html5_endpoint=sess.html5_endpoint,
                    ),
                    "authorization_key": sess.authorization_key,
                    "authorization_value": sess.authorization_value,
                }
            ):
                logging.info("WebSocket closed while sending connected message")
            return

        if not self._safe_write(
            {
                "action": "connected",
                "url": JAVA_IFRAME_PATH_FORMAT.format(
                    url=sess.url,
                    external_web_dns=external_web_dns,
                    port=sess.web_port,
                    password=sess.vnc_password,
                ),
            }
        ):
            logging.info("WebSocket closed while sending connected message")

    def on_close(self):
        logging.info(
            "WS from %s closed code=%s reason=%r",
            None if self._current_user is None else self._current_user["name"],
            self.close_code,
            self.close_reason,
        )
        self._is_closed = True
        if self._connect_task is not None and not self._connect_task.done():
            self._connect_task.cancel()
        self._connecting = False
        if self._current_session is not None:
            self._release_web_port(self._web_port)
            self._current_session.kill_process()
            self._current_session = None
        elif self._web_port and self._web_port in used_ports:
            self._release_web_port(self._web_port)


__all__ = ["KVMHandler"]
