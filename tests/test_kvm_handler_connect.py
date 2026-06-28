import asyncio
import json
import unittest
from unittest import mock

import kvm_handler
from kvm_handler import KVMHandler, used_ports
from nojava_ipmi_kvm.kvm import JavaKvmViewer


class _FakeHostConfig:
    full_hostname = "bmc.example"
    skip_login = False


class ConnectSpawnsTaskTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        used_ports.clear()

    def _make_handler(self):
        handler = KVMHandler.__new__(KVMHandler)
        handler._current_user = {"name": "tester", "is_admin": True}
        handler._connecting = False
        handler._is_closed = False
        handler._connect_task = None
        handler._current_session = None
        handler._web_port = 0
        handler.write_message = mock.Mock()
        handler.get_cookie = mock.Mock(return_value=None)
        return handler

    async def test_on_message_returns_before_connect_finishes(self):
        connect_started = asyncio.Event()
        allow_finish = asyncio.Event()

        async def slow_start(*args, **kwargs):
            connect_started.set()
            await allow_finish.wait()
            return JavaKvmViewer(
                "http://localhost:8800/vnc.html",
                "localhost",
                8800,
                lambda: None,
                "secret",
            )

        handler = self._make_handler()
        host_config = _FakeHostConfig()
        mock_config = mock.Mock()
        mock_config.get_servers.return_value = ["host1"]
        mock_config.__getitem__ = mock.Mock(return_value=host_config)

        with mock.patch.object(kvm_handler, "start_kvm_container", slow_start):
            with mock.patch.object(kvm_handler, "config", mock_config):
                    with mock.patch.object(kvm_handler, "WEB_PORT_START", 8800):
                        with mock.patch.object(kvm_handler, "WEB_PORT_END", 8802):
                            await handler.on_message(
                                json.dumps(
                                    {
                                        "action": "connect",
                                        "server": "host1",
                                        "password": "secret",
                                        "resolution": "1280x960",
                                    }
                                )
                            )

                            self.assertIsNotNone(handler._connect_task)
                            await asyncio.wait_for(connect_started.wait(), timeout=1)
                            self.assertFalse(handler._connect_task.done())

                            allow_finish.set()
                            await handler._connect_task

        handler.write_message.assert_called()
        connected_calls = [
            call
            for call in handler.write_message.call_args_list
            if call.args and call.args[0].get("action") == "connected"
        ]
        self.assertEqual(len(connected_calls), 1)


if __name__ == "__main__":
    unittest.main()
