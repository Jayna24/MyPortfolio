const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const filters = document.querySelectorAll(".filter");
const materialCards = document.querySelectorAll(".material-card");
const publicMaterialRows = document.querySelector("#publicMaterialRows");
const materialList = document.querySelector("#materialList");

const adminLoginButton = document.querySelector("#adminLogin");
const adminLogoutLink = document.querySelector("#adminLogout");
const uploadMaterialButton = document.querySelector("#uploadMaterial");
const loginStatus = document.querySelector("#loginStatus");
const uploadStatus = document.querySelector("#uploadStatus");
const githubTokenInput = document.querySelector("#githubToken");
const githubRepoInput = document.querySelector("#githubRepo");
const materialSubject = document.querySelector("#materialSubject");
const materialType = document.querySelector("#materialType");
const materialTitle = document.querySelector("#materialTitle");
const materialFile = document.querySelector("#materialFile");
const materialFormTitle = document.querySelector("#materialFormTitle");
const cancelEditButton = document.querySelector("#cancelEdit");

const SESSION_TOKEN_KEY = "myportfolioGithubToken";
const SESSION_REPO_KEY = "myportfolioGithubRepo";

const state = {
  token: "",
  repo: "Jayna24/MyPortfolio",
  branch: "main",
  materials: [],
  editIndex: null
};

navToggle?.addEventListener("click", () => {
  const isOpen = siteNav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

siteNav?.addEventListener("click", (event) => {
  if (event.target.matches("a") && event.target.id !== "adminLogout") {
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

adminLoginButton?.addEventListener("click", async () => {
  state.token = githubTokenInput.value.trim();
  state.repo = githubRepoInput.value.trim() || "Jayna24/MyPortfolio";

  if (!state.token) {
    setText(loginStatus, "Enter a GitHub token to continue.");
    return;
  }

  setText(loginStatus, "Checking GitHub access...");
  try {
    await githubApi(`repos/${state.repo}`);
    sessionStorage.setItem(SESSION_TOKEN_KEY, state.token);
    sessionStorage.setItem(SESSION_REPO_KEY, state.repo);
    setText(loginStatus, "Login successful. Opening material upload page...");
    window.location.href = "materials-admin.html";
  } catch (error) {
    setText(loginStatus, `Login failed: ${error.message}`);
  }
});

adminLogoutLink?.addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_REPO_KEY);
});

uploadMaterialButton?.addEventListener("click", async () => {
  const file = materialFile.files?.[0];
  const title = materialTitle.value.trim();
  const isEditing = state.editIndex !== null;

  if (!file && !isEditing) {
    setText(uploadStatus, "Choose a file first.");
    return;
  }

  if (!title) {
    setText(uploadStatus, "Enter a material title.");
    return;
  }

  uploadMaterialButton.disabled = true;
  setText(uploadStatus, isEditing ? "Saving material changes..." : "Uploading file to GitHub...");

  try {
    const previousItem = isEditing ? state.materials[state.editIndex] : null;
    let repoPath = previousItem?.path || "";
    let fileName = previousItem?.fileName || "";
    let url = previousItem?.url || "";

    if (file) {
      const safeSubject = slugify(materialSubject.value);
      const safeName = `${Date.now()}-${slugify(file.name)}`;
      repoPath = `materials/${safeSubject}/${safeName}`;
      const content = await fileToBase64(file);

      await writeGitHubFile(repoPath, content, `Upload ${file.name}`);
      fileName = file.name;
      url = repoPath;

      if (previousItem?.path && previousItem.path !== repoPath) {
        await deleteGitHubFile(previousItem.path, `Delete replaced material ${previousItem.fileName || previousItem.path}`, true);
      }
    }

    const item = {
      id: previousItem?.id || String(Date.now()),
      subject: materialSubject.value,
      title,
      type: materialType.value,
      fileName,
      path: repoPath,
      url,
      uploadedAt: previousItem?.uploadedAt || new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10)
    };

    if (isEditing) {
      state.materials[state.editIndex] = item;
    } else {
      state.materials = [item, ...state.materials];
    }

    await writeMaterialsJson();
    renderAdminMaterials();
    resetMaterialForm();
    setText(uploadStatus, "Saved. GitHub Pages will show the update after deployment finishes.");
    await showAlert("Saved", "Material information has been saved successfully.", "success");
  } catch (error) {
    setText(uploadStatus, `Save failed: ${error.message}`);
    await showAlert("Save failed", error.message, "error");
  } finally {
    uploadMaterialButton.disabled = false;
  }
});

materialList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const index = Number(button.dataset.index);
  const item = state.materials[index];
  if (!item) return;

  if (button.dataset.action === "edit") {
    startEdit(index);
    return;
  }

  if (button.dataset.action === "delete") {
    const confirmed = await confirmDelete(item.title);
    if (!confirmed) return;

    setText(uploadStatus, "Deleting material...");
    try {
      if (item.path) {
        await deleteGitHubFile(item.path, `Delete material ${item.fileName || item.title}`, true);
      }
      state.materials.splice(index, 1);
      await writeMaterialsJson();
      renderAdminMaterials();
      resetMaterialForm();
      setText(uploadStatus, "Deleted. GitHub Pages will update after deployment finishes.");
      await showAlert("Deleted", "Material has been removed.", "success");
    } catch (error) {
      setText(uploadStatus, `Delete failed: ${error.message}`);
      await showAlert("Delete failed", error.message, "error");
    }
  }
});

cancelEditButton?.addEventListener("click", () => {
  resetMaterialForm();
  setText(uploadStatus, "Edit cancelled.");
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

async function initMaterialsAdmin() {
  if (!document.querySelector("#materialUploadForm")) return;

  state.token = sessionStorage.getItem(SESSION_TOKEN_KEY) || "";
  state.repo = sessionStorage.getItem(SESSION_REPO_KEY) || "Jayna24/MyPortfolio";

  if (!state.token) {
    window.location.href = "admin-login.html";
    return;
  }

  setText(uploadStatus, "Loading uploaded materials...");
  try {
    await githubApi(`repos/${state.repo}`);
    state.materials = await readMaterialsFromGitHub();
    renderAdminMaterials();
    setText(uploadStatus, "Ready. Upload new material from the upper form.");
  } catch (error) {
    setText(uploadStatus, `Session failed: ${error.message}`);
    await showAlert("Login expired", "Please login again with a valid GitHub token.", "error");
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_REPO_KEY);
    window.location.href = "admin-login.html";
  }
}

function renderAdminMaterials() {
  if (!materialList) return;
  if (!state.materials.length) {
    materialList.innerHTML = "<p>No materials published yet.</p>";
    return;
  }

  materialList.innerHTML = `
    <div class="admin-grid-row admin-grid-head">
      <span>Title</span>
      <span>Subject</span>
      <span>Type</span>
      <span>File</span>
      <span>Actions</span>
    </div>
    ${state.materials.map((item, index) => {
      const link = item.url ? `<a href="${item.url}" target="_blank" rel="noopener">Open</a>` : "<span>No file</span>";
      return `
        <div class="admin-grid-row">
          <span>${escapeHtml(item.title)}</span>
          <span>${escapeHtml(item.subject)}</span>
          <span>${escapeHtml(item.type)}</span>
          <span>${link}</span>
          <span class="admin-actions">
            <button class="button neutral" type="button" data-action="edit" data-index="${index}">Edit</button>
            <button class="button danger" type="button" data-action="delete" data-index="${index}">Delete</button>
          </span>
        </div>
      `;
    }).join("")}
  `;
}

function startEdit(index) {
  const item = state.materials[index];
  state.editIndex = index;
  materialSubject.value = item.subject || "Operating Systems";
  materialType.value = item.type || "Lecture Notes";
  materialTitle.value = item.title || "";
  materialFile.value = "";
  materialFormTitle.textContent = "Edit Material";
  uploadMaterialButton.textContent = "Save Changes";
  cancelEditButton.hidden = false;
  setText(uploadStatus, "Editing selected material. Choose a new file only if you want to replace the existing file.");
  materialTitle.focus();
}

function resetMaterialForm() {
  state.editIndex = null;
  if (materialTitle) materialTitle.value = "";
  if (materialFile) materialFile.value = "";
  if (materialFormTitle) materialFormTitle.textContent = "Upload New Material";
  if (uploadMaterialButton) uploadMaterialButton.textContent = "Upload To GitHub";
  if (cancelEditButton) cancelEditButton.hidden = true;
}

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

async function deleteGitHubFile(path, message, ignoreMissing = false) {
  const sha = await getFileSha(path);
  if (!sha) {
    if (ignoreMissing) return null;
    throw new Error(`File not found: ${path}`);
  }

  return githubApi(`repos/${state.repo}/contents/${encodePath(path)}`, {
    method: "DELETE",
    body: JSON.stringify({
      message,
      sha,
      branch: state.branch
    })
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

async function confirmDelete(title) {
  if (window.Swal) {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Delete "${title}" from uploaded materials?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#b42318",
      cancelButtonColor: "#0f766e",
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel"
    });
    return result.isConfirmed;
  }

  return window.confirm(`Are you sure you want to delete "${title}"?`);
}

async function showAlert(title, text, icon) {
  if (window.Swal) {
    await Swal.fire({ title, text, icon, confirmButtonColor: "#0f766e" });
  }
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

function setText(element, message) {
  if (element) element.textContent = message;
}

loadPublicMaterials();
initMaterialsAdmin();
