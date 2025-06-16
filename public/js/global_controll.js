function updateTabContainer() {
  const tabContainer = document.querySelector(".tab-container");
  if (window.innerWidth < 600) {
    tabContainer.classList.add("vertical");
    tabContainer.classList.remove("horizontal");
  } else {
    tabContainer.classList.add("horizontal");
    tabContainer.classList.remove("vertical");
  }
}

function openTab(tabName, tab) {
  // remove "clicked" class from all tabs
  var tabs = document.querySelectorAll(".tab");
  tabs.forEach(function (tab) {
    tab.classList.remove("clicked");
  });

  // add "clicked" class to the clicked tab
  tab.classList.add("clicked");

  if (tabName === "tab1") {
    window.location.href = "/home";
  } else if (tabName === "tab2") {
    window.location.href = "/me";
  } else if (tabName === "tab3") {
    window.location.href = "/contact";
  } else if (tabName === "tab4") {
    window.location.href = "/mystuff";
  } else {
    console.log("Opening " + tabName);
  }
}

window.addEventListener("resize", function () {
  updateTabContainer();
});

document.addEventListener("DOMContentLoaded", function () {
  updateTabContainer();
  
  document.querySelectorAll('.tab').forEach((tab, index) => {
    if (index == 0) {
      tab.textContent = `Home`;
    } else if (index == 1) {
      tab.textContent = `Airzy`;
    } else if (index == 2) {
      tab.textContent = `Contacts`;
    } else if (index == 3) {
      tab.textContent = `Resources`;
    } else {
      tab.textContent = `???`;
    }
    
    const underline = document.createElement('div');
    underline.className = 'underline';
    tab.appendChild(underline);
  });
});
