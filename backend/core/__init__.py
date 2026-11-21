import os
import sys

# Ensure flat sibling imports (from config import …) and parent imports work
# when this package is loaded directly.
_CORE_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_CORE_DIR)
_PARENT_DIR = os.path.dirname(_BACKEND_DIR)
for _p in [_CORE_DIR, _BACKEND_DIR, _PARENT_DIR]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

