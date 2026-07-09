# Dr. Jayna Donga Academic Portfolio

This folder contains a GitHub Pages-ready academic portfolio website for Dr. Jayna Donga.

## Files

- `index.html`: Portfolio website.
- `styles.css`: Responsive visual design.
- `script.js`: Mobile menu, subject filters, and material-list preview.
- `assets/dr-jayna-donga.jpg`: Profile photo.
- `assets/educator-hero.png`: Background education image.
- `google-sites-content.md`: Static content kit for Google Sites.

## Main Sections

- Home
- About
- Qualifications & Skills
- Subjects Taught
- Subject-Wise Materials
- Academic Experience
- Research Profile
- Responsibilities
- Contact

## Admin Material Management Note

The public page reads `materials.json` and shows student-facing subject materials only. The admin page at `admin.html` lets an authorized admin enter a GitHub token in the browser, upload a file into the repository under `materials/`, and update `materials.json` so students can download the published material.

Use a fine-grained GitHub token limited to this repository with Contents read/write access. Do not hard-code the token into the website.

