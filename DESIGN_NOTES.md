# Phase 1

I want a tool I can use to facilitate live coding in the classroom for introductory level computer science courses. Initially the tool should focus on Python.

## Use case / functional requirements
1. Start a coding session from my laptop, display join code
1. Type in a problem to display on the screen (no starter code yet)
1. Students can join from browser, write code, run it, see output
1. The editor should have syntax highlighting and linting
1. I can see a list of students who are coding, and see their code in realtime
1. I can show and run their code on my screen, anonymously
1. I can copy and edit their code for instructional purposes

## Non-requirements
1. I don’t need to be able to collaboratively edit in the same file as a student
1. Students only need access to a single code file at a time
1. No need to support third party package installation
1. I don’t need persistent storage of anything in this phase

## Proposed architecture
Next.js app, express backend. Typescript everywhere. Student code will be executed remotely on the server.

On the surface it would make more sense to have a Python/flask backend to facilitate server-side execution of code, but I envision expanding to more languages in the future and want to maintain a strong boundary between the code execution environment and serving the webapp / handling of websockets.

# Phases 2-N
1. Store revision history
1. Pre-defined problem repository
1. Ability to provide test cases that students can run, see friendly output from, and debug
1. Ability for students to add their own test cases
1. Integrated debugger, based on PythonTutor
1. Debugging tool: when an error is raised, drop into the debugger at the place where it was raised
1. Be able to provide starter code
1. AI analysis/categorization of errors
1. Sandboxed code execution

# Even further in the future
1. Setup appropriate for out-of-class activities
1. Setup appropriate for live coding exams
1. Both of the above require “hidden” test cases - test cases that can be run automatically but that students can’t see
1. AI analysis of coding process (i.e. examine revision history) and end product to assess competency
