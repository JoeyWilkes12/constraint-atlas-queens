# Constraint Atlas execution scope

Within this project directory, agents may:

- execute the zero-dependency Node build scripts;
- run this project's automated tests and validation scripts;
- launch a local static server for browser verification; and
- use local browser automation to verify the generated GitHub Pages artifact.

Preserve `.openai/hosting.json` and the existing Sites build unless a task
explicitly changes the Sites deployment. Do not clone external repositories,
execute unrelated code, or mutate sibling projects.
