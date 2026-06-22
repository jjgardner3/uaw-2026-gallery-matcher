#!/usr/bin/env python3
"""
Reverse-geocode galleries.json using Nominatim OpenStreetMap API.
Adds an 'address' field to each gallery that has lat/lng but no address.
Saves progress after each batch of 25.
"""

import json
import urllib.request
import time
import sys

FILE = '/Users/jjgardner3/Library/CloudStorage/GoogleDrive-jjgardner3@gmail.com/My Drive/UAW 2026/UAW 2026/gallery-matcher/galleries.json'
UA = 'UAW2026-GalleryMatcher/1.0 (jjgardner3@gmail.com)'
BATCH_SIZE = 25
DELAY = 1.1  # seconds between requests

def reverse_geocode(lat, lng):
    url = f'https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json&addressdetails=1'
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())

def build_address(addr):
    house = addr.get('house_number', '')
    road = addr.get('road', '')
    city = addr.get('city') or addr.get('town') or addr.get('village') or addr.get('hamlet') or ''
    state = addr.get('state', '')
    postcode = addr.get('postcode', '')
    street = f'{house} {road}'.strip() if house else road
    parts = [p for p in [street, city, f'{state} {postcode}'.strip()] if p]
    return ', '.join(parts)

def load_data():
    with open(FILE) as f:
        return json.load(f)

def save_data(data):
    with open(FILE, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def main():
    data = load_data()
    total = len(data)
    
    needs_geocoding = [(i, g) for i, g in enumerate(data)
                       if 'address' not in g and 'lat' in g and 'lng' in g]
    
    print(f'Total galleries: {total}')
    print(f'Already have address: {sum(1 for g in data if "address" in g)}')
    print(f'Missing lat/lng: {sum(1 for g in data if "lat" not in g or "lng" not in g)}')
    print(f'Need geocoding: {len(needs_geocoding)}')
    print()

    added = 0
    failed = []

    for batch_start in range(0, len(needs_geocoding), BATCH_SIZE):
        batch = needs_geocoding[batch_start:batch_start + BATCH_SIZE]
        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (len(needs_geocoding) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f'--- Batch {batch_num}/{total_batches} ({len(batch)} galleries) ---')

        for i, gallery in batch:
            try:
                result = reverse_geocode(gallery['lat'], gallery['lng'])
                addr_obj = result.get('address', {})
                address = build_address(addr_obj)
                data[i]['address'] = address
                added += 1
                print(f'  [OK] {gallery["name"]}: {address}')
            except Exception as e:
                failed.append((i, gallery.get('name'), str(e)))
                print(f'  [FAIL] {gallery["name"]}: {e}')
            time.sleep(DELAY)

        # Save after each batch
        save_data(data)
        print(f'  Progress saved. Running total: {added} added, {len(failed)} failed.\n')

    print('=' * 60)
    print(f'DONE: {added} addresses added, {len(failed)} failed')
    if failed:
        print('\nFailed galleries:')
        for idx, name, err in failed:
            print(f'  [{idx}] {name}: {err}')

if __name__ == '__main__':
    main()
