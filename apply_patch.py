#!/usr/bin/env python3
"""
Run this script in your project folder:
  python apply_patch.py

It will patch src/app/player/[id]/page.tsx with the OfferButton changes.
"""
import os

path = os.path.join('src', 'app', 'player', '[id]', 'page.tsx')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Change 1: add OfferButton import
old1 = "import { calcOvr } from '@/lib/ovr'"
new1 = "import { calcOvr } from '@/lib/ovr'\nimport OfferButton from './OfferButton'"
if old1 in content and 'import OfferButton' not in content:
    content = content.replace(old1, new1)
    print('✅ Added OfferButton import')
else:
    print('⚠️  Import already exists or anchor not found')

# Change 2: add OfferButton JSX before the stats section
old2 = '      </div>\n\n      <div className="flex flex-col gap-0">'
new2 = '      </div>\n\n      {!player.team_id && (\n        <OfferButton playerId={player.id} isAssigned={!!player.on_gleague_assignment} />\n      )}\n\n      <div className="flex flex-col gap-0">'
if old2 in content and '<OfferButton' not in content:
    content = content.replace(old2, new2)
    print('✅ Added OfferButton JSX')
else:
    print('⚠️  JSX already exists or anchor not found')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done! Now run: git add src/app/player/[id]/page.tsx && git commit -m "feat: add OfferButton to player page" && git push origin main')
