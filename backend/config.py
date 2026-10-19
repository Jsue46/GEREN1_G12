import os
from dotenv import load_dotenv

load_dotenv()

ODOO_URL = os.getenv("ODOO_URL", "http://40.116.83.248:8069")
ODOO_DB = os.getenv("ODOO_DB", "gamerzone_db")
ODOO_USER = os.getenv("ODOO_USER", "diegout76@gmail.com")
ODOO_PASSWORD = os.getenv("ODOO_PASSWORD", "12345")

# Port for FastAPI server
SERVER_PORT = int(os.getenv("SERVER_PORT", "8000"))
