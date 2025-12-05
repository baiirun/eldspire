# Database Migrations

This document describes how to manage D1 database migrations for Eldspire.

## Overview

Migrations are SQL files located in the `migrations/` directory. They are applied sequentially using Wrangler and tracked automatically by D1.

## Running Migrations

### Remote (Production)

Apply all pending migrations to the production database:

```bash
bun wrangler d1 migrations apply eldspire --remote
```

### Local Development

Apply migrations to the local D1 database:

```bash
bun wrangler d1 migrations apply eldspire --local
```

## Creating Migrations

Create a new migration file in the `migrations/` directory with a sequential prefix:

```bash
touch migrations/0003_your_migration_name.sql
```

Migration files should contain valid SQL statements. Each migration runs in a transaction.

## Checking Migration Status

List applied and pending migrations:

```bash
bun wrangler d1 migrations list eldspire --remote
```
