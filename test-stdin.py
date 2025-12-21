#!/usr/bin/env python3
"""Quick test script to verify stdin functionality"""

import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Test Python code with stdin
test_code = """
name = input("Enter your name: ")
age = input("Enter your age: ")
print(f"Hello {name}, you are {age} years old!")
"""

test_stdin = "Alice\n25\n"

print("Testing stdin support...")
print("Code to execute:")
print(test_code)
print("\nInput (stdin):")
print(repr(test_stdin))
print("\n--- Running executeCode ---")

# Import and run
from subprocess import Popen, PIPE

process = Popen(['python3', '-c', test_code], stdin=PIPE, stdout=PIPE, stderr=PIPE)
stdout, stderr = process.communicate(input=test_stdin.encode())

print("\nOutput:")
print(stdout.decode())

if stderr:
    print("Errors:")
    print(stderr.decode())

print("Exit code:", process.returncode)
print("\n✅ Test complete! If you see 'Hello Alice, you are 25 years old!' above, stdin works correctly.")
