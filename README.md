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

The public page reads `materials.json` and shows student-facing subject materials only. Admin login is handled at `admin-login.html`. After login, `materials-admin.html` lets an authorized admin upload files into the repository under `materials/`, update `materials.json`, and manage uploaded content in a grid with Edit and Delete options.

Use a fine-grained GitHub token limited to this repository with Repository permissions -> Contents: Read and write. Do not hard-code the token into the website.

