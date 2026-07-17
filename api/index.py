"""Vercel serverless function wrapper for FastAPI."""
import sys
from pathlib import Path

# Add parent directory to path to import modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from api import app

# Export the ASGI app for Vercel
