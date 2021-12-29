#!/bin/bash
DB_PATH="data/crawler.db"
# create empty db
sqlite3 $DB_PATH < create_db.sql
# add tables
sqlite3 $DB_PATH < create_tables.sql