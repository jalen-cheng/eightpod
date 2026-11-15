"""Tests for backup_database.sh; run with python3 -m unittest discover -s scripts/tests."""

import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import unittest


scripts_path = Path(__file__).resolve().parents[1]
node_path = shutil.which('node')


def node_has_sqlite():
    if not node_path:
        return False
    check = subprocess.run([node_path, '-e', "require('node:sqlite')"], capture_output=True)
    return check.returncode == 0


class BackupDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary_folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_folder.cleanup)
        self.folder = Path(self.temporary_folder.name)
        self.source = self.folder / 'source.db'
        self.destination = self.folder / 'destination.db'
        # A database with a committed write still sitting in the write-ahead log
        self.original = sqlite3.connect(self.source)
        self.addCleanup(self.original.close)
        self.original.execute('PRAGMA journal_mode=WAL')
        self.original.execute('PRAGMA wal_autocheckpoint=0')
        self.original.execute('CREATE TABLE movement (id INTEGER PRIMARY KEY, total_movement INTEGER NOT NULL)')
        self.original.execute('INSERT INTO movement VALUES (1, 58)')
        self.original.execute('INSERT INTO movement VALUES (2, 62)')
        self.original.commit()

    def run_backup(self, python_bin, node_bin):
        environment = dict(os.environ, FREE_SLEEP_PYTHON=python_bin, FREE_SLEEP_NODE=node_bin)
        return subprocess.run(
            ['sh', str(scripts_path / 'backup_database.sh'), str(self.source), str(self.destination)],
            env=environment, capture_output=True, text=True, stdin=subprocess.DEVNULL,
        )

    def count_backed_up_rows(self):
        with sqlite3.connect(self.destination) as backup:
            return backup.execute('SELECT count(*) FROM movement').fetchone()[0]

    def test_python_is_used_when_it_has_sqlite(self):
        result = self.run_backup('python3', '/nonexistent/node')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.count_backed_up_rows(), 2)

    @unittest.skipUnless(node_has_sqlite(), 'needs a Node with built-in SQLite')
    def test_node_is_used_when_python_cannot_open_sqlite(self):
        # `false` stands in for a Python that fails to import sqlite3, as on the Pod 5
        result = self.run_backup('false', node_path)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('backing up with Node', result.stdout)
        self.assertEqual(self.count_backed_up_rows(), 2)

    @unittest.skipUnless(node_has_sqlite(), 'needs a Node with built-in SQLite')
    def test_failed_node_backup_keeps_the_previous_backup(self):
        self.original.close()
        self.source.write_bytes(b'broken database')
        self.destination.write_bytes(b'previous good backup')
        result = self.run_backup('false', node_path)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.destination.read_bytes(), b'previous good backup')
        self.assertFalse(Path(str(self.destination) + '.partial').exists())

    def test_files_are_copied_when_nothing_can_open_sqlite(self):
        result = self.run_backup('false', '/nonexistent/node')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('copying the database files', result.stderr)
        self.assertTrue(Path(str(self.destination) + '-wal').exists())
        self.assertEqual(self.count_backed_up_rows(), 2)


if __name__ == '__main__':
    unittest.main()
