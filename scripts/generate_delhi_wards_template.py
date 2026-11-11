#!/usr/bin/env python3
"""
Generates a pre-populated CSV template with all 250 Delhi MCD Wards mapped to their
official 12 MCD Zones, ready for the data/calling team to fill in member names and phone numbers.

Usage:
    python3 scripts/generate_delhi_wards_template.py
"""

import csv
import os

ZONES = [
    ("Narela", 1, 16),
    ("Civil Lines", 17, 35),
    ("Rohini", 36, 58),
    ("Keshav Puram", 59, 73),
    ("City-SP", 74, 86),
    ("Karol Bagh", 87, 99),
    ("West", 100, 124),
    ("Najafgarh", 125, 146),
    ("South", 147, 169),
    ("Central", 170, 194),
    ("Shahdara South", 195, 222),
    ("Shahdara North", 223, 250),
]

def get_zone(ward_no):
    for zone, start, end in ZONES:
        if start <= ward_no <= end:
            return zone
    return "Central"

def main():
    out_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_file = os.path.join(out_dir, "delhi_250_wards_members_template.csv")

    headers = ["name", "mobile", "ward", "ward name", "district", "assembly"]
    rows = []

    # Generate 5 member slots per ward by default (total 1,250 - 1,400 members)
    for ward_no in range(1, 251):
        district = get_zone(ward_no)
        for slot in range(1, 6):
            rows.append({
                "name": f"Ward {ward_no} Member {slot}",
                "mobile": f"9800{ward_no:03d}{slot:02d}",
                "ward": ward_no,
                "ward name": f"Ward {ward_no}",
                "district": district,
                "assembly": "",
            })

    with open(out_file, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Successfully generated template with {len(rows)} rows for 250 Delhi wards:")
    print(f"Saved to: {out_file}")

if __name__ == "__main__":
    main()

