#!/usr/bin/env python3
"""
Generate the downloadable import-template workbooks (plan tasks 6+7).

Thin wrapper around api-server/batch-parsing/generate_import_templates.py — the
implementation lives there so the in-container unittest suite can import it
(the api-server dev container only mounts api-server/). Run inside the
api-server container, e.g.:

    python3 /app/batch-parsing/generate_import_templates.py --outdir /tmp/templates

then docker cp the outputs to front-cards/public/templates/.
"""

import os
import sys

sys.path.insert(
    0,
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "api-server", "batch-parsing"),
)

from generate_import_templates import main

if __name__ == "__main__":
    sys.exit(main())
