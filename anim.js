const defaultConfigPath = "./config.json";

const elements = {
  backgroundVideo: document.querySelector("#background-video"),
  backgroundVideoSource: document.querySelector("#background-video-source"),
  profileAvatar: document.querySelector("#profile-avatar"),
  avatarFallback: document.querySelector("#avatar-fallback"),
  profileName: document.querySelector("#profile-name"),
  profileSubtitle: document.querySelector("#profile-subtitle"),
  videoMessage: document.querySelector("#video-message"),
  soundToggle: document.querySelector("#sound-toggle"),
  copyLink: document.querySelector("#copy-link"),
  viewCount: document.querySelector("#view-count"),
};

function showMessage(message) {
  elements.videoMessage.textContent = message;
  elements.videoMessage.hidden = false;
}

function hideMessage() {
  elements.videoMessage.hidden = true;
}

function syncSoundToggle() {
  const soundEnabled = !elements.backgroundVideo.muted;
  elements.soundToggle.setAttribute("aria-label", soundEnabled ? "Desativar som" : "Ativar som");
  elements.soundToggle.title = soundEnabled ? "Desativar som" : "Ativar som";
  elements.soundToggle.setAttribute("aria-pressed", String(soundEnabled));
}

function showImage(image, source) {
  if (!source) {
    image.removeAttribute("src");
    image.style.display = "none";
    return;
  }

  image.onload = () => {
    image.style.display = "block";
    if (image === elements.profileAvatar) {
      elements.avatarFallback.style.display = "none";
    }
  };
  image.onerror = () => {
    image.style.display = "none";
    if (image === elements.profileAvatar) {
      elements.avatarFallback.style.display = "grid";
    }
  };
  image.src = source;
}

function getActiveProfile(config) {
  if (!Array.isArray(config.profiles) || config.profiles.length === 0) {
    throw new Error("Adicione pelo menos um perfil à lista profiles em config.json.");
  }

  const requestedId = new URLSearchParams(window.location.search).get("profile");
  const profileId = requestedId || config.activeProfile;
  const profile = config.profiles.find((item) => item.id === profileId);

  if (!profile) {
    throw new Error(`O perfil "${profileId}" não existe na lista profiles de config.json.`);
  }

  return profile;
}

function renderConfig(config) {
  const profile = getActiveProfile(config);

  document.title = profile.name || "Bio";
  elements.profileName.textContent = profile.name || "";
  elements.profileSubtitle.textContent = profile.subtitle || "";
  elements.avatarFallback.textContent = (profile.name || "?").trim().charAt(0).toUpperCase();
  showImage(elements.profileAvatar, profile.image);

  const videoPath = config.backgroundVideo;
  if (typeof videoPath !== "string" || !videoPath.trim()) {
    throw new Error("Defina o caminho do vídeo local em backgroundVideo no config.json.");
  }

  elements.backgroundVideoSource.src = videoPath;
  elements.backgroundVideoSource.type = videoPath.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4";
  elements.backgroundVideo.loop = true;
  elements.backgroundVideo.muted = true;
  elements.backgroundVideo.volume = 1;
  syncSoundToggle();
  elements.backgroundVideo.load();
  elements.backgroundVideo.play().catch((error) => {
    showMessage("Toque na tela para iniciar o vídeo.");
    console.error("Falha ao iniciar o vídeo:", error);
  });

  loadViewCount();
}

async function loadViewCount() {
  try {
    const alreadyCounted = sessionStorage.getItem("biosite-view-counted") === "true";
    const response = await fetch("/api/views", {
      method: alreadyCounted ? "GET" : "POST",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`O servidor respondeu HTTP ${response.status}.`);
    }

    const result = await response.json();
    if (!Number.isSafeInteger(result.views) || result.views < 0) {
      throw new Error("O contador retornou um total inválido.");
    }

    elements.viewCount.textContent = new Intl.NumberFormat("pt-BR").format(result.views);
    if (!alreadyCounted) {
      sessionStorage.setItem("biosite-view-counted", "true");
    }
  } catch (error) {
    elements.viewCount.textContent = "—";
    console.error("Não foi possível carregar o contador global de visitas:", error);
  }
}

elements.soundToggle.addEventListener("click", () => {
  const enablingSound = elements.backgroundVideo.muted;
  if (enablingSound) {
    elements.backgroundVideo.volume = 1;
    elements.backgroundVideo.muted = false;
    if (elements.backgroundVideo.paused) {
      elements.backgroundVideo.play().catch((error) => {
        showMessage("O navegador bloqueou a reprodução. Toque novamente para tentar.");
        console.error("Falha ao iniciar o vídeo com som:", error);
      });
    }
    if (!elements.backgroundVideo.paused) {
      hideMessage();
    }
  } else {
    elements.backgroundVideo.muted = true;
  }
  syncSoundToggle();
});

elements.backgroundVideo.addEventListener("ended", () => {
  elements.backgroundVideo.currentTime = 0;
  elements.backgroundVideo.play().catch((error) => {
    showMessage("Não foi possível reiniciar o vídeo.");
    console.error("Falha ao repetir o vídeo:", error);
  });
});

elements.backgroundVideo.addEventListener("volumechange", syncSoundToggle);

elements.backgroundVideo.addEventListener("error", () => {
  showMessage("Vídeo não encontrado ou formato não suportado. Adicione db/background.mp4.");
});

elements.backgroundVideo.addEventListener("playing", () => {
  if (!elements.backgroundVideo.muted) {
    hideMessage();
  }
});

elements.copyLink.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    elements.copyLink.title = "Link copiado";
    window.setTimeout(() => {
      elements.copyLink.title = "Copiar link do perfil";
    }, 1800);
  } catch (error) {
    showMessage("Não foi possível copiar o link. Copie o endereço da página manualmente.");
    console.error("Falha ao copiar o link do perfil:", error);
  }
});

fetch(defaultConfigPath)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Não foi possível carregar config.json (HTTP ${response.status}).`);
    }
    return response.json();
  })
  .then(renderConfig)
  .catch((error) => {
    showMessage(error.message);
    console.error("Falha ao iniciar o biosite:", error);
  });