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
    const repoData = await githubApi(`repos/${state.repo}`);
    verifyRepositoryWriteAccess(repoData);
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

    const savedMaterials = await mutateLatestMaterials((latestMaterials) => {
      if (isEditing) {
        const latestIndex = findMaterialIndex(latestMaterials, previousItem);
        if (latestIndex === -1) {
          latestMaterials.unshift(item);
        } else {
          latestMaterials[latestIndex] = item;
        }
      } else {
        latestMaterials.unshift(item);
      }
      return latestMaterials;
    });
    state.materials = savedMaterials;
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
      const savedMaterials = await mutateLatestMaterials((latestMaterials) => {
        const latestIndex = findMaterialIndex(latestMaterials, item);
        if (latestIndex !== -1) latestMaterials.splice(latestIndex, 1);
        return latestMaterials;
      });
      state.materials = savedMaterials;
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

materialList?.addEventListener("dragstart", (event) => {
  const row = event.target.closest(".admin-grid-row[data-index]");
  if (!row) return;
  row.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", row.dataset.index);
});

materialList?.addEventListener("dragover", (event) => {
  const row = event.target.closest(".admin-grid-row[data-index]");
  if (!row) return;
  event.preventDefault();
  row.classList.add("is-drag-over");
});

materialList?.addEventListener("dragleave", (event) => {
  const row = event.target.closest(".admin-grid-row[data-index]");
  row?.classList.remove("is-drag-over");
});

materialList?.addEventListener("drop", async (event) => {
  const row = event.target.closest(".admin-grid-row[data-index]");
  if (!row) return;
  event.preventDefault();
  clearDragClasses();

  const fromIndex = Number(event.dataTransfer.getData("text/plain"));
  const toIndex = Number(row.dataset.index);
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex === toIndex) return;

  await reorderMaterials(fromIndex, toIndex);
});

materialList?.addEventListener("dragend", () => {
  clearDragClasses();
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
    const repoData = await githubApi(`repos/${state.repo}`);
    verifyRepositoryWriteAccess(repoData);
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
      <span>Order</span>
      <span>Title</span>
      <span>Subject</span>
      <span>Type</span>
      <span>File</span>
      <span>Actions</span>
    </div>
    ${state.materials.map((item, index) => {
      const link = item.url ? `<a href="${item.url}" target="_blank" rel="noopener">Open</a>` : "<span>No file</span>";
      return `
        <div class="admin-grid-row" draggable="true" data-index="${index}">
          <span class="drag-cell" title="Drag to reorder">Drag</span>
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

async function reorderMaterials(fromIndex, toIndex) {
  const movingItem = state.materials[fromIndex];
  const targetItem = state.materials[toIndex];
  if (!movingItem || !targetItem) return;

  const previousMaterials = [...state.materials];
  const reordered = [...state.materials];
  const [removed] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, removed);
  state.materials = reordered;
  renderAdminMaterials();
  setText(uploadStatus, "Saving public display order...");

  try {
    const savedMaterials = await mutateLatestMaterials((latestMaterials) => {
      const latestFrom = findMaterialIndex(latestMaterials, movingItem);
      const latestTo = findMaterialIndex(latestMaterials, targetItem);
      if (latestFrom === -1 || latestTo === -1) return latestMaterials;
      const [latestRemoved] = latestMaterials.splice(latestFrom, 1);
      latestMaterials.splice(latestTo, 0, latestRemoved);
      return latestMaterials;
    });
    state.materials = savedMaterials;
    renderAdminMaterials();
    setText(uploadStatus, "Order saved. Public Materials page will update after deployment finishes.");
  } catch (error) {
    state.materials = previousMaterials;
    renderAdminMaterials();
    setText(uploadStatus, `Order save failed: ${error.message}`);
    await showAlert("Order save failed", error.message, "error");
  }
}

function clearDragClasses() {
  materialList?.querySelectorAll(".is-dragging, .is-drag-over").forEach((row) => {
    row.classList.remove("is-dragging", "is-drag-over");
  });
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
  const result = await readMaterialsDocumentFromGitHub();
  return result.materials;
}

async function readMaterialsDocumentFromGitHub() {
  try {
    const data = await githubApi(`repos/${state.repo}/contents/materials.json?ref=${state.branch}`);
    const json = decodeBase64Utf8(data.content || "");
    return {
      materials: JSON.parse(json),
      sha: data.sha
    };
  } catch (error) {
    if (error.message.includes("404")) return { materials: [], sha: null };
    throw error;
  }
}

async function writeMaterialsJson() {
  const document = await readMaterialsDocumentFromGitHub();
  const existing = document.sha;
  const content = encodeBase64Utf8(JSON.stringify(state.materials, null, 2));
  await writeGitHubFile("materials.json", content, "Update published materials", existing);
}

async function mutateLatestMaterials(mutator, attempt = 1) {
  const document = await readMaterialsDocumentFromGitHub();
  const nextMaterials = mutator([...document.materials]);
  const content = encodeBase64Utf8(JSON.stringify(nextMaterials, null, 2));

  try {
    await writeGitHubFile("materials.json", content, "Update published materials", document.sha);
    return nextMaterials;
  } catch (error) {
    if (attempt < 3 && isConflictError(error)) {
      return mutateLatestMaterials(mutator, attempt + 1);
    }
    throw error;
  }
}

function findMaterialIndex(materials, target) {
  if (!target) return -1;
  return materials.findIndex((item) =>
    (target.id && item.id === target.id) ||
    (target.path && item.path === target.path) ||
    (item.title === target.title && item.subject === target.subject && item.type === target.type)
  );
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
    throw new Error(formatGitHubError(response.status, message));
  }

  if (response.status === 204) return null;
  return response.json();
}

function verifyRepositoryWriteAccess(repoData) {
  const permissions = repoData?.permissions;
  if (!permissions) return;
  const canWrite = permissions.push || permissions.admin || permissions.maintain;
  if (!canWrite) {
    throw new Error("This token can read the repository but cannot change files. Create a fine-grained GitHub token for Jayna24/MyPortfolio with Repository permissions -> Contents: Read and write.");
  }
}

function formatGitHubError(status, message) {
  if (status === 409) {
    return "GitHub reported a content conflict because materials were changed recently. The page refreshes the latest list and retries automatically; if this message remains, please try again once.";
  }

  if (status === 403 && message.includes("Resource not accessible by personal access token")) {
    return "GitHub refused this action because the token does not have Contents: Read and write permission for Jayna24/MyPortfolio. Edit or recreate the token with Repository permissions -> Contents: Read and write, then login again.";
  }

  if (status === 401) {
    return "GitHub token is invalid or expired. Create a new token and login again.";
  }

  return `${status} ${message}`;
}

function isConflictError(error) {
  return String(error.message || "").includes("409");
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
