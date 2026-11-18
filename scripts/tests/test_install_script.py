"""Checks on scripts/install.sh that need no Pod."""
import pathlib
import unittest

INSTALL_SCRIPT = pathlib.Path(__file__).resolve().parents[1] / 'install.sh'


class InstallScriptTest(unittest.TestCase):
    def test_journal_group_is_found_without_getent(self):
        """The Pod has no getent; using it left the server without the group that lets it read
        button presses, so the buttons did nothing."""
        script = INSTALL_SCRIPT.read_text()
        code_lines = [line for line in script.splitlines() if not line.lstrip().startswith('#')]
        self.assertFalse(any('getent' in line for line in code_lines), 'install.sh must not call getent')
        self.assertIn("grep -q '^systemd-journal:' /etc/group", script)
        self.assertIn('SupplementaryGroups=systemd-journal', script)


if __name__ == '__main__':
    unittest.main()
