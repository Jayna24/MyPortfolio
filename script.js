const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const filters = document.querySelectorAll(".filter");
const materialCards = document.querySelectorAll(".material-card");
const publicMaterialRows = document.querySelector("#publicMaterialRows");
const materialList = document.querySelector("#materialList");

const adminLoginButton = document.querySelector("#adminLogin");
const uploadMaterialButton = document.querySelector("#uploadMaterial");
const loginStatus = document.querySelector("#loginStatus");
const uploadStatus = document.querySelector("#uploadStatus");
const githubTokenInput = document.querySelector("#githubToken");
const githubRepoInput = document.querySelector("#githubRepo");
const materialSubject = document.querySelector("#materialSubject");
const materialType = document.querySelector("#materialType");
const materialTitle = document.querySelector("#materialTitle");
const materialFile = document.querySelector("#materialFile");
const materialUploadForm = document.querySelector("#materialUploadForm");

const state = {
  token: "",
  repo: "Jayna24/MyPortfolio",
  branch: "main",
  materials: []
};

navToggle?.addEventListener("click", () => {
  const isOpen = siteNav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

siteNav?.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    siteNav.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  }
});

filters.forEach((filterButton) => {
  filterButton.addEventListener("click", () => {
    const selected = filterButton.dataset.filter;

    filters.forEach((button) => button.classList.remove("is-active"));
    filterButton.classList.add("is-active");

    materialCards.forEach((card) => {
      const shouldShow = selected === "all" || card.dataset.subject === selected;
      card.hidden = !shouldShow;
    });

    renderPublicMaterials(state.materials, selected);
  });
});

function subjectGroup(subject) {
  const value = subject.toLowerCase();
  if (value.includes("operating") || value.includes("distributed")) return "systems";
  if (value.includes("data") || value.includes("programming") || value.includes("c programming")) return "programming";
  if (value.includes("compiler") || value.includes("graphics") || value.includes("uml")) return "design";
  return "all";
}

function activeFilter() {
  return document.querySelector(".filter.is-active")?.dataset.filter || "all";
}

function renderPublicMaterials(materials, selected = activeFilter()) {
  if (!publicMaterialRows) return;
  const visible = materials.filter((item) => selected === "all" || subjectGroup(item.subject) === selected);

  if (!visible.length) {
    publicMaterialRows.innerHTML = `
      <div class="resource-row" role="row">
        <span role="cell">No material</span>
        <span role="cell">No published files are available for this filter yet.</span>
        <span role="cell">-</span>
        <span role="cell">-</span>
      </div>
    `;
    return;
  }

  publicMaterialRows.innerHTML = visible.map((item) => {
    const access = item.url
      ? `<a href="${item.url}" target="_blank" rel="noopener" download>Download</a>`
      : `<a href="#contact">Request Link</a>`;
    return `
      <div class="resource-row" role="row">
        <span role="cell">${escapeHtml(item.subject)}</span>
        <span role="cell">${escapeHtml(item.title)}</span>
        <span role="cell">${escapeHtml(item.type)}</span>
        <span role="cell">${access}</span>
      </div>
    `;
  }).join("");
}

async function loadPublicMaterials() {
  if (!publicMaterialRows) return;
  try {
    const response = await fetch(`materials.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load materials.");
    state.materials = await response.json();
    renderPublicMaterials(state.materials);
  } catch (error) {
    publicMaterialRows.innerHTML = `
      <div class="resource-row" role="row">
        <span role="cell">Unavailable</span>
        <span role="cell">Materials could not be loaded right now.</span>
        <span role="cell">-</span>
        <span role="cell">Try later</span>
      </div>
    `;
  }
}

function renderAdminMaterials() {
  if (!materialList) return;
  if (!state.materials.length) {
    materialList.innerHTML = "<li>No materials published yet.</li>";
    return;
  }

  materialList.innerHTML = state.materials.map((item) => {
    const link = item.url ? ` - <a href="${item.url}" target="_blank" rel="noopener">Open</a>` : "";
    return `<li><strong>${escapeHtml(item.subject)}:</strong> ${escapeHtml(item.title)} (${escapeHtml(item.type)})${link}</li>`;
  }).join("");
}

function setUploadEnabled(enabled) {
  materialUploadForm?.classList.toggle("is-disabled", !enabled);
  [materialSubject, materialType, materialTitle, materialFile, uploadMaterialButton].forEach((control) => {
    if (control) control.disabled = !enabled;
  });
}

adminLoginButton?.addEventListener("click", async () => {
  state.token = githubTokenInput.value.trim();
  state.repo = githubRepoInput.value.trim() || "Jayna24/MyPortfolio";

  if (!state.token) {
    loginStatus.textContent = "Enter a GitHub token to continue.";
    return;
  }

  loginStatus.textContent = "Checking GitHub access...";
  try {
    await githubApi(`repos/${state.repo}`);
    state.materials = await readMaterialsFromGitHub();
    renderAdminMaterials();
    setUploadEnabled(true);
    loginStatus.textContent = "Connected. You can upload materials now.";
    uploadStatus.textContent = "Choose a file and upload it to GitHub.";
  } catch (error) {
    setUploadEnabled(false);
    loginStatus.textContent = `Login failed: ${error.message}`;
  }
});

uploadMaterialButton?.addEventListener("click", async () => {
  const file = materialFile.files?.[0];
  const title = materialTitle.value.trim();

  if (!file) {
    uploadStatus.textContent = "Choose a file first.";
    return;
  }

  if (!title) {
    uploadStatus.textContent = "Enter a material title.";
    return;
  }

  uploadMaterialButton.disabled = true;
  uploadStatus.textContent = "Uploading file to GitHub...";

  try {
    const safeSubject = slugify(materialSubject.value);
    const safeName = `${Date.now()}-${slugify(file.name)}`;
    const repoPath = `materials/${safeSubject}/${safeName}`;
    const content = await fileToBase64(file);

    await writeGitHubFile(repoPath, content, `Upload ${file.name}`);

    const item = {
      subject: materialSubject.value,
      title,
      type: materialType.value,
      fileName: file.name,
      path: repoPath,
      url: repoPath,
      uploadedAt: new Date().toISOString().slice(0, 10)
    };

    state.materials = [item, ...state.materials];
    await writeMaterialsJson();
    renderAdminMaterials();
    materialTitle.value = "";
    materialFile.value = "";
    uploadStatus.textContent = "Uploaded. GitHub Pages will show it publicly after the deployment finishes.";
  } catch (error) {
    uploadStatus.textContent = `Upload failed: ${error.message}`;
  } finally {
    uploadMaterialButton.disabled = false;
  }
});

async function readMaterialsFromGitHub() {
  try {
    const data = await githubApi(`repos/${state.repo}/contents/materials.json?ref=${state.branch}`);
    const json = decodeBase64Utf8(data.content || "");
    return JSON.parse(json);
  } catch (error) {
    if (error.message.includes("404")) return [];
    throw error;
  }
}

async function writeMaterialsJson() {
  const existing = await getFileSha("materials.json");
  const content = encodeBase64Utf8(JSON.stringify(state.materials, null, 2));
  await writeGitHubFile("materials.json", content, "Update published materials", existing);
}

async function writeGitHubFile(path, base64Content, message, sha = null) {
  const payload = {
    message,
    content: base64Content,
    branch: state.branch
  };
  if (sha) payload.sha = sha;
  return githubApi(`repos/${state.repo}/contents/${encodePath(path)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

async function getFileSha(path) {
  try {
    const data = await githubApi(`repos/${state.repo}/contents/${encodePath(path)}?ref=${state.branch}`);
    return data.sha;
  } catch (error) {
    if (error.message.includes("404")) return null;
    throw error;
  }
}

async function githubApi(endpoint, options = {}) {
  const response = await fetch(`https://api.github.com/${endpoint}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${state.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${response.status} ${message}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function encodeBase64Utf8(value) {
  return btoa(unescape(encodeURIComponent(value)));
}

function decodeBase64Utf8(value) {
  return decodeURIComponent(escape(atob(value.replace(/\s/g, ""))));
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadPublicMaterials();
