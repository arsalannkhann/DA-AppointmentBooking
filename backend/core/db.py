"""
Database connection — SQLAlchemy engine, session factory, and schema init.
"""
import os
from contextlib import contextmanager
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase
from config import DATABASE_URL


engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    echo=False,
    connect_args={"connect_timeout": 10},
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


@contextmanager
def get_db():
    """Transactional session context manager."""
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def deploy_schema():
    """Drop and recreate all tables from schema.sql."""
    drop_order = [
        "bronn_token_blacklist", "bronn_audit_logs", "bronn_login_attempts", "bronn_users",
        "patient_settings",
        "appointments", "calendar_slots", "availability_templates",
        "procedures", "patients", "staff", "doctor_specializations",
        "specializations", "doctor_availability", "doctors", "rooms", "clinics",
    ]
    with engine.connect() as conn:
        for tbl in drop_order:
            conn.execute(text(f"DROP TABLE IF EXISTS {tbl} CASCADE"))
        conn.commit()

    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path) as f:
        ddl = f.read()

    # Run base schema + all migrations in order
    migration_files = [
        "migration_001_auth.sql",
        "migration_002_patient_auth.sql",
        "migration_003_tenant_isolation.sql",
        "migration_004_global_patients.sql",
        "migration_005_patient_audit_token.sql",
    ]
    migrations_sql = ""
    for mf in migration_files:
        mpath = os.path.join(os.path.dirname(__file__), mf)
        if os.path.exists(mpath):
            with open(mpath) as f:
                migrations_sql += f.read() + "\n"

    raw = engine.raw_connection()
    try:
        cur = raw.cursor()
        cur.execute(ddl)
        cur.execute(migrations_sql)
        raw.commit()
        cur.close()
    finally:
        raw.close()
