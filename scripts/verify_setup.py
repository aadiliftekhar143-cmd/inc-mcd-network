#!/usr/bin/env python3
"""
Pre-flight check script to verify configuration readiness before deploying Ward Sadasya.

Usage:
    python3 scripts/verify_setup.py
"""

import os
import sys

def check_file(path, description):
    if os.path.exists(path):
        print(f"  [OK] {description} exists: {path}")
        return True
    else:
        print(f"  [MISSING] {description} not found: {path}")
        return False

def check_placeholders(path, placeholder):
    if not os.path.exists(path):
        return False
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if placeholder in content:
        print(f"  [ACTION NEEDED] {path} still contains placeholder '{placeholder}'")
        return False
    print(f"  [OK] {path} credentials configured")
    return True

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print("=" * 60)
    print("Ward Sadasya · Pre-flight Launch Readiness Check")
    print("=" * 60)

    print("\n1. Supabase Backend:")
    check_file(os.path.join(root, "supabase", "schema.sql"), "SQL Schema")
    check_file(os.path.join(root, "supabase", "functions", "app", "index.ts"), "Edge Function API")

    print("\n2. Admin Panel:")
    check_file(os.path.join(root, "admin", "package.json"), "Admin package.json")
    env_file = os.path.join(root, "admin", ".env")
    if check_file(env_file, "Admin .env file"):
        check_placeholders(env_file, "YOUR-PROJECT")

    print("\n3. Android Member App:")
    gradle_props = os.path.join(root, "android", "gradle.properties")
    if check_file(gradle_props, "gradle.properties"):
        check_placeholders(gradle_props, "YOUR-PROJECT")

    gradlew = os.path.join(root, "android", "gradlew")
    if check_file(gradlew, "Gradle wrapper script"):
        if os.access(gradlew, os.X_OK):
            print("  [OK] gradlew is executable")
        else:
            print("  [WARN] gradlew is not marked executable. Run: chmod +x android/gradlew")

    print("\n4. Master Data:")
    check_file(os.path.join(root, "delhi_250_wards_members_template.csv"), "Delhi 250 Wards Template")

    print("\n" + "=" * 60)
    print("Next steps:")
    print("1. Update Supabase URL and anon key in admin/.env and android/gradle.properties")
    print("2. Run 'supabase functions deploy app --no-verify-jwt'")
    print("3. Deploy 'admin' folder to Vercel")
    print("4. Build APK: cd android && ./gradlew assembleRelease")
    print("=" * 60)

if __name__ == "__main__":
    main()

