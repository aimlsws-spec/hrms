"""Shared MySQL connection helper for the MVC data layer."""

import mysql.connector
from backend.config import DB_CONFIG


def get_connection():
    """Open a new MySQL connection using the project DB_CONFIG."""
    return mysql.connector.connect(**DB_CONFIG)
