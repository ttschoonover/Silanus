const container = document.getElementById("ruleContainer");
const typeFilter = document.getElementById("typeFilter");
const tagFilter = document.getElementById("tagFilter");
const stakeholderFilter = document.getElementById("stakeholderFilter"); // Stakeholder filter
const sidebar = document.getElementById("infoSidebar");
const sidebarContent = document.getElementById("sidebarContent");
const languageSelect = document.getElementById("languageSelect");

let allRules = [];
let currentLanguage = "english";

async function fetchRules() {
  const response = await fetch("rules.json");
  return await response.json();
}

function getUniqueTags(rules) {
  const tagSet = new Set();
  rules.forEach(rule => {
    if (rule.tags) {
      rule.tags.forEach(tag => tagSet.add(tag));
    }
  });
  return Array.from(tagSet);
}

function getUniqueStakeholders(rules) {
  const stakeholderSet = new Set();
  rules.forEach(rule => {
    if (rule.stakeholders) {
      rule.stakeholders.forEach(stakeholder => stakeholderSet.add(stakeholder));
    }
  });
  return Array.from(stakeholderSet);
}

function updateTagFilterOptions(tags) {
  tagFilter.innerHTML = '<option value="all">All Tags</option>';
  tags.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = tag;
    tagFilter.appendChild(opt);
  });
}

function updateStakeholderFilterOptions(stakeholders) {
  stakeholderFilter.innerHTML = ''; // Clear existing options
  const allOpt = document.createElement('option');
  allOpt.value = 'all';
  allOpt.textContent = 'All Stakeholders';
  stakeholderFilter.appendChild(allOpt);
  
  stakeholders.forEach(stakeholder => {
    const opt = document.createElement('option');
    opt.value = stakeholder;
    opt.textContent = stakeholder;
    stakeholderFilter.appendChild(opt);
  });
}

function findAllUpstream(rule, rules, visited = new Set()) {
  const results = [];
  if (!rule.links || rule.links.length === 0 || visited.has(rule.id)) return results;
  visited.add(rule.id);
  
  rule.links.forEach(linkId => {
    const parent = rules.find(r => r.id === linkId);
    if (parent && !visited.has(parent.id)) {
      results.push({
        ...parent,
        nestedParents: findAllUpstream(parent, rules, visited) // Find nested parents
      });
    }
  });
  return results;
}

function findChildren(rule, rules, visited = new Set()) {
  if (visited.has(rule.id)) return []; // Avoid circular references
  visited.add(rule.id);
  
  const children = rules.filter(r => r.links && r.links.includes(rule.id));
  return children.map(child => ({
    ...child,
    nestedChildren: findChildren(child, rules, visited) // Find nested children
  }));
}

function getDisplayedText(rule) {
  if (currentLanguage === "french") {
    return `<p class="fancy-cursive">${rule.translation}</p>`;
  } else {
    return `<p>${rule.content}</p>`;
  }
}

function renderRules(rules, type, tag, singleRuleId = null) {
  container.innerHTML = "";
  sidebar.style.display = "none";
  sidebarContent.innerHTML = "";

  let filtered = rules;

  if (singleRuleId !== null) {
    const rule = rules.find(r => r.id === singleRuleId);
    console.log("Fetching rule with ID:", singleRuleId); // Debugging line
    console.log("Found rule:", rule); // Debugging line
    if (!rule) {
      container.innerHTML = `<p>Rule #${singleRuleId} not found.</p>`;
      return;
    }

    function createRuleDiv(rule, nested = false, collapsed = true) {
      const wrapper = document.createElement("div");
      wrapper.className = `rule ${rule.type}`;
      wrapper.id = `rule-${rule.id}`;
      if (nested) wrapper.style.marginLeft = "1rem";

      const bodyId = `body-${rule.id}`;
      wrapper.innerHTML = `
        <div class="rule-header" onclick="toggleRuleBody(${rule.id})">
          <span><strong>#${rule.id} ${rule.name}</strong></span>
          <span class="type-label">${rule.type}</span>
        </div>
        <div class="rule-body" id="${bodyId}" style="display: ${collapsed ? 'none' : 'block'};">
          ${getDisplayedText(rule)}
          ${rule.tags ? `<p>${rule.tags.map(tag => `<span class="tag-link" onclick="filterByTag('${tag}')">#${tag}</span>`).join(' ')}</p>` : ''}
        </div>
      `;
      return wrapper;
    }

    function renderLinkedSection(title, relatedRules, direction) {
      if (relatedRules.length === 0) return null;

      const sectionWrapper = document.createElement("div");
      const toggleId = `toggle-${direction}`;

      sectionWrapper.innerHTML = `
        <div class="rule-header" onclick="document.getElementById('${toggleId}').style.display =
          document.getElementById('${toggleId}').style.display === 'none' ? 'block' : 'none'">
          <strong>${title} (${relatedRules.length})</strong>
        </div>
        <div id="${toggleId}" style="display: block; margin-left: 1rem;"></div>
      `;

      const innerContainer = sectionWrapper.querySelector(`#${toggleId}`);
      
      // Recursive function to render nested parents or children
      function renderNestedRules(rules, margin = "1rem") {
        rules.forEach(r => {
          const wrapper = document.createElement("div");
          wrapper.className = `rule ${r.type}`;
          wrapper.style.marginLeft = margin; // Add margin for nesting

          const bodyId = `body-${r.id}`;
          wrapper.innerHTML = `
            <div class="rule-header" onclick="toggleRuleBody(${r.id})">
              <span>
                <strong>#${r.id} ${r.name}</strong>
                <a class="external-link" href="?id=${r.id}" onclick="event.stopPropagation()">🔗</a>
              </span>
              <span class="type-label">${r.type}</span>
            </div>
            <div class="rule-body" id="${bodyId}" style="display: none;">
              ${getDisplayedText(r)}
              ${r.tags ? `<p>${r.tags.map(tag => `<span class="tag-link" onclick="filterByTag('${tag}'); event.stopPropagation();">#${tag}</span>`).join(' ')}</p>` : ''}
            </div>
          `;

          innerContainer.appendChild(wrapper);
          
          // If the rule has nested parents or children, render them recursively
          if (r.nestedParents && r.nestedParents.length > 0) {
            renderNestedRules(r.nestedParents, "2rem"); // Increase margin for nesting
          }
          if (r.nestedChildren && r.nestedChildren.length > 0) {
            renderNestedRules(r.nestedChildren, "2rem"); // Increase margin for nesting
          }
        });
      }

      renderNestedRules(relatedRules); // Initial call to render

      return sectionWrapper;
    }

    container.innerHTML = "";

    // Main rule
    container.appendChild(createRuleDiv(rule, false, false));

    // Links (upstream)
    const upstream = findAllUpstream(rule, rules);
    const upstreamSection = renderLinkedSection("🔗 Links", upstream, "upstream");
    if (upstreamSection) container.appendChild(upstreamSection);

    // Linked By (downstream)
    const downstream = findChildren(rule, rules);
    const downstreamSection = renderLinkedSection("🔗 Linked By", downstream, "downstream");
    if (downstreamSection) container.appendChild(downstreamSection);

    // Navigation buttons
    const nav = document.createElement("div");
    nav.style.marginTop = "2rem";
    nav.style.display = "flex";
    nav.style.justifyContent = "space-between";

    const prevBtn = document.createElement("button");
    prevBtn.textContent = "⬅️ Previous";
    prevBtn.onclick = () => {
      const prevId = rule.id - 1;
      history.pushState({}, "", `?id=${prevId}`);
      showRuleById(prevId);
    };
    if (rule.id <= 1) prevBtn.disabled = true;

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next ➡️";
    nextBtn.onclick = () => {
      const nextId = rule.id + 1;
      history.pushState({}, "", `?id=${nextId}`);
      showRuleById(nextId);
    };

    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    container.appendChild(nav);
  } else {
    if (type !== "all") filtered = filtered.filter(r => r.type === type);
    if (tag !== "all") filtered = filtered.filter(r => r.tags && r.tags.includes(tag));
    filtered.sort((a, b) => a.id - b.id);

    filtered.forEach(rule => {
      const div = document.createElement("div");
      div.className = `rule ${rule.type}`;
      div.id = `rule-${rule.id}`;
      div.innerHTML = `
        <div class="rule-header" onclick="toggleRuleBody(${rule.id})">
          <span><strong>#${rule.id} ${rule.name}</strong>
            <a class="external-link" href="?id=${rule.id}">🔗</a></span>
          <span class="type-label"><a href="#" onclick="filterByType('${rule.type}'); event.stopPropagation();">${rule.type}</a></span>
        </div>
        <div class="rule-body" id="body-${rule.id}" style="display: none;">
          ${getDisplayedText(rule)}
          <div>${rule.tags ? rule.tags.map(tag => `<span class="tag-link" onclick="filterByTag('${tag}')">#${tag}</span>`).join('') : ''}</div>
        </div>
      `;
      container.appendChild(div);
    });
  }
}

function toggleRuleBody(id) {
  const el = document.getElementById(`body-${id}`);
  if (el) {
    el.style.display = el.style.display === "block" ? "none" : "block";
  }
}

function filterByTag(tag) {
  tagFilter.value = tag;
  renderRules(allRules, typeFilter.value, tagFilter.value);
}

function filterByType(type) {
  typeFilter.value = type;
  renderRules(allRules, typeFilter.value, tagFilter.value);
}

function goBack() {
  history.pushState({}, "", window.location.pathname);
  renderRules(allRules, typeFilter.value, tagFilter.value);
}

function goNext(id) {
  const nextId = id + 1;
  const rule = allRules.find(r => r.id === nextId);
  if (rule) {
    history.pushState({}, "", `?id=${nextId}`);
    showRuleById(nextId);
  }
}

function showRuleById(id) {
  renderRules(allRules, null, null, parseInt(id)); // Ignore stakeholders when showing specific rule
}

// Fetch data and render
fetchRules().then(rules => {
  allRules = rules;
  updateTagFilterOptions(getUniqueTags(rules));
  updateStakeholderFilterOptions(getUniqueStakeholders(rules)); // Update stakeholder options
  const urlParams = new URLSearchParams(window.location.search);
  const currentId = urlParams.get('id');
  if (currentId) {
    showRuleById(parseInt(currentId)); // Ensure we parse the ID as an integer
  } else {
    stakeholderFilter.value = 'all'; // Set default to all stakeholders
    renderRules(allRules, typeFilter.value, tagFilter.value);
  }
});

// Event listeners
typeFilter.addEventListener("change", () => {
  renderRules(allRules, typeFilter.value, tagFilter.value);
});

tagFilter.addEventListener("change", () => {
  renderRules(allRules, typeFilter.value, tagFilter.value);
});

document.getElementById("displayAllBtn").addEventListener("click", () => {
  const btn = document.getElementById("displayAllBtn");
  const isCollapsed = btn.dataset.state === "collapsed";
  document.querySelectorAll(".rule-body").forEach(body => {
    body.style.display = isCollapsed ? "block" : "none";
  });
  btn.textContent = isCollapsed ? "🔒 Collapse All" : "🔓 Display All";
  btn.dataset.state = isCollapsed ? "expanded" : "collapsed";
});

languageSelect.addEventListener("change", () => {
  currentLanguage = languageSelect.value;
  const urlParams = new URLSearchParams(window.location.search);
  const currentId = urlParams.get('id');
  if (currentId) {
    showRuleById(parseInt(currentId)); // Ensure we parse the ID as an integer
  } else {
    renderRules(allRules, typeFilter.value, tagFilter.value);
  }
});
