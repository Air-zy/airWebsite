function getDayOfWeek(year, month, day) {
    // adjust month and year if month is January or February
    if (month < 3) {
        month += 12;
        year -= 1;
    }

    let K = year % 100; // year of the century
    let J = Math.floor(year / 100); // zero-based century

    // zellers congruence formula
    let dayOfWeek = (day + Math.floor(13 * (month + 1) / 5) + K + Math.floor(K / 4) + Math.floor(J / 4) + 5 * J) % 7;

    // zellers congruence returns 0 = Saturday, 1 = Sunday, ..., 6 = Friday
    // adjust it to return 1 = Monday, ..., 7 = Sunday
    let adjustedDayOfWeek = ((dayOfWeek + 5) % 7) + 1;
    return adjustedDayOfWeek;
}

const monthLookup = {
    "01": "January",
    "02": "February",
    "03": "March",
    "04": "April",
    "05": "May",
    "06": "June",
    "07": "July",
    "08": "August",
    "09": "September",
    "10": "October",
    "11": "November",
    "12": "December"
};

const daysOfWeek = ["", "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
function getWeekIndex(entryDate) {
    let [year, month, day] = entryDate.split('-').map(Number);
    return [daysOfWeek[getDayOfWeek(year, month, day)], day];
}

function formatMonthDate(dateStr) {
    const year = dateStr.slice(0, 4); // the year part (YYYY)
    const monthNumber = dateStr.slice(5, 7); // the month part (MM)
    const day = dateStr.slice(8, 10); // the day part (DD)

    const monthName = monthLookup[monthNumber]; // the month name from the lookup table
    return `${monthName} ${day}, ${year}`;
}

function getTimeSt() {
  const now = new Date();
  return now.toISOString().split('T')[0]
}


function downloadTxt(data, filename) {
  
  const fileExtension = filename.split('.').pop().toLowerCase();
  
  // get the MIME type based on file extension
  let mimeType;
  if (fileExtension === "txt") {
    mimeType = "text/plain";
  } else if (fileExtension === "enc") {
    mimeType = "application/octet-stream"
  } else {
    console.error("Unsupported file format. Please use .txt or .enc");
    return;
  }
  
  const blob = new Blob([data], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  
  if (fileExtension === "txt") {
    link.target = "_blank";
    link.rel = "noopener"; // security avoid tab hijacks
  } else if (fileExtension === "enc") {
    link.target = "";
    link.rel = "";
  }
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function xorEncryptDecrypt(input, key) {
  let output = "";

  for (let i = 0; i < input.length; i++) {
    const mixedKeyChar = key.charCodeAt(i % key.length) ^ i;
    output += String.fromCharCode(input.charCodeAt(i) ^ mixedKeyChar);
  }

  return output;
}

function clearDropDown() {
  document
    .querySelectorAll(".navbutton")
    .forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".dropDown").forEach((element) => {
    element.style.height = "0";
    setTimeout(() => {
      element.remove();
    }, 300);
  });
}

function newDButton(txt, att) {
  const button = document.createElement("button");
  button.className = "dbutton";
  button.setAttribute("onclick", att);
  button.textContent = " ‣ " + txt;
  return button;
}

function newDButtonCB(txt, callback) {
  const button = document.createElement("button");
  button.className = "dbutton";
  button.onclick = callback;
  button.textContent = " ‣ " + txt;
  return button;
}

function newInputDButton(txt, func) {
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = txt

  input.addEventListener("blur", () => {
    func(input)
  });

  input.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      input.blur(); // unfocus
    }
  });
  
  return input;
}

const categoryTemplate = {
  topic: "New Category",
  creationTimestamp: "",
}

const entryTemplate = {
  date: "",
  value: "",
}
      
let journal = {
  author: "",
  title: "",
  creationTimestamp: getTimeSt(),
  categories: [
    {
      topic: "Work",
      creationTimestamp: getTimeSt(),
    },
    {
      topic: "Personal",
      creationTimestamp: getTimeSt(),
    },
    {
      topic: "Travel",
      creationTimestamp: getTimeSt(),
    },
  ],
  entries: {
    "Website Redesign": {
      date: getTimeSt(),
      value: "Deadline Sep 30 I wanna cry :sob:",
      category: 0,
    },
    "HTML Fruit Radio": {
      date: getTimeSt(),
      value: `<form>
        <label>
            <input type="radio" name="fruit" value="apple" required>
            Apple
        </label><br>
        
        <label>
            <input type="radio" name="fruit" value="banana">
            Banana
        </label><br>
        
        <label>
            <input type="radio" name="fruit" value="orange">
            Orange
        </label><br>
        
        <label>
            <input type="radio" name="fruit" value="grape">
            Grape
        </label><br>
        
        <button type="submit">Submit</button>
    </form>`,
      category: 0,
    },
    "Hike": {
      date: getTimeSt(),
      value: "I LOVE HIKING SO MUCH!!",
      category: 2,
    },
  }
};
let journalPassword = ""; // for encrypting journal


function deleteCategory(elm, i) {
  let entriesToDelete = [];
  for (let name in journal.entries) {
    const entry = journal.entries[name];
    if (entry.category === i) {
      entriesToDelete.push(name);
    }
  }

  if (entriesToDelete.length == 0) {
    journal.categories.splice(0, 1);
    for (let name in journal.entries) { // move over
      console.log("r",name)
      const entry = journal.entries[name]
      if (entry.category > i) {
        journal.entries[name].category = entry.category-1
      }
    }
    loadJournal();
  } else {
    const confirmV = confirm(`delete ${entriesToDelete.length} entries inside \`${journal.categories[i].topic}?\``);
    if (confirmV) {
      entriesToDelete.forEach((name) => {
        delete journal.entries[name];
      })
      for (let name in journal.entries) { // move over
        console.log("r",name)
        const entry = journal.entries[name]
        if (entry.category > i) {
          journal.entries[name].category = entry.category-1
        }
      }
      journal.categories.splice(0, 1);
    }
    loadJournal();
  }
}

function newEntry(elm, i) {
  let entryClone = Object.assign({}, entryTemplate); // new copy
  let entryKey = "???"
  entryClone.date = getTimeSt();
  entryClone.category = i;
  
  if (journal.categories.length <= i) {
      console.log("is short")
      journal.categories.splice(i, 0, Object.assign({}, categoryTemplate));
  }

  const rect = elm.getBoundingClientRect();
  const dropdownElement = document.createElement("div");
  dropdownElement.classList.add("dropDown");
  
  dropdownElement.appendChild(
    newInputDButton("Name", function(input) {
      const string = String(input.value);
      const newString = string.length > 32 ? string.substring(0, 32) : string;
      
      if (journal.entries[entryKey]) {
        input.placeholder = "name a"
        input.value = ""
        return;
      }
      entryKey = newString
      input.value = newString
    })
  );
  
  const DateInput = document.createElement("input");
  DateInput.type = "date";
  DateInput.className = "dbuttonDate";
  DateInput.placeholder = "Select a date"
  
  DateInput.addEventListener("change", function(event) {
      const selectedDate = event.target.value;
      entryClone.date = selectedDate;
      console.log("Selected date:", selectedDate);
  })
  
  dropdownElement.appendChild(DateInput);
  
  dropdownElement.appendChild(
    newDButtonCB("Create", function(input) {
      //entryClone.creationTimestamp = getTimeSt();
      journal.entries[entryKey] = entryClone
      loadJournal();
    })
  );
  document.body.appendChild(dropdownElement);

  dropdownElement.style.position = "absolute";
  dropdownElement.style.left = `${rect.left + rect.width}px`; // align with the left side of the element
  dropdownElement.style.top = `${rect.top}px`; // pos below the element
  setTimeout(() => {
    dropdownElement.style.height = "100px";
  }, 1);
}

function makeEntry(elm) {
  newEntry(elm, 0)
}

function makeCategory(elm) {
  let newCategory = Object.assign({}, categoryTemplate); // new copy
  
  const rect = elm.getBoundingClientRect();
  const dropdownElement = document.createElement("div");
  dropdownElement.classList.add("dropDown");
  
  dropdownElement.appendChild(
    newInputDButton("Name Category", function(input) {
      const string = String(input.value);
      const newString = string.length > 32 ? string.substring(0, 32) : string;
      
      newCategory.topic = newString
      input.value = newString
    })
  );
  dropdownElement.appendChild(
    newDButtonCB("Create", function(input) {
      newCategory.creationTimestamp = getTimeSt();
      
      journal.categories.splice(0, 0, newCategory) // add to front
      for (let name in journal.entries) { // move over
        const entry = journal.entries[name]
        journal.entries[name].category = entry.category+1
      }
      loadJournal();
    })
  );
  
  document.body.appendChild(dropdownElement);

  dropdownElement.style.position = "absolute";
  dropdownElement.style.left = `${rect.left + rect.width}px`; // align with the left side of the element
  dropdownElement.style.top = `${rect.top}px`; // pos below the element
  setTimeout(() => {
    dropdownElement.style.height = "100px";
  }, 1);

}

function changePassword(span, i) {
  span.innerText = "";
  let passwordVerified = false;
  const input = document.createElement("input");
  if (journalPassword.length > 0) {
    // has password
    input.type = "password";
    input.placeholder = "Enter OLD password";
  } else {
    passwordVerified = true; // no pasword set yet
    input.type = "text";
    input.placeholder = "Enter NEW password";
  }

  span.replaceWith(input);
  input.focus();

  input.addEventListener("blur", () => {
    if (passwordVerified == false) {
      if (input.value == journalPassword) {
        passwordVerified = true;
        input.value = "";
        input.type = "text";
        input.placeholder = "Enter NEW password";
        console.log("password verified");
      } else {
        alert("wrong password");
      }
    } else {
      const string = String(input.value);
      const newString = string.length > 32 ? string.substring(0, 32) : string;
      if (newString.length > 0) {
        const confirmV = confirm(`set journal password to \`${newString}\`?`);
        if (confirmV) {
          journalPassword = newString;
        }
      }

      const lockIcons = document.querySelectorAll(".icon-lock");
      if (journalPassword.length > 0) {
        lockIcons.forEach((icon) => {
          icon.style.display = "block";
        });
      } else {
        lockIcons.forEach((icon) => {
          icon.style.display = "none";
        });
      }
      clearDropDown();
    }
  });

  input.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      input.blur(); // unfocus
    }
  });
}

function renameCatergory(span, i) {
  span.innerText = "";
  const originalText = span.innerText;
  const input = document.createElement("input");
  input.type = "text";
  input.value = originalText;

  span.replaceWith(input);
  input.focus();

  input.addEventListener("blur", () => {
    const string = String(input.value);
    const newString = string.length > 32 ? string.substring(0, 32) : string;
    journal.categories[i].topic = newString;
    loadJournal();
  });

  input.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      input.blur(); // unfocus
    }
  });
}

let editingEntry = undefined;
function editPanelClose() {
  const panel = document.getElementById("editPanel");
  panel.style.width = 0
  editingEntry = undefined;
}

function entryPanel(key) {
  if (editingEntry != key) {
    const panel = document.getElementById("editPanel");
    panel.style.width = 1000 + "px"
    editingEntry = key
    
    const entry = journal.entries[editingEntry]
    const cmHolder = document.querySelector('.cm-holder');
    cmHolder.innerHTML = entry.value;
    if (cmHolder.innerHTML.trim() == "") {
      cmHolder.innerHTML = ""
    }
    
    const title = document.querySelector('#editPanelTitle');
    title.value = key
    
    const date = document.querySelector('#editPanelDate');
    date.value = journal.entries[key].date
  } else {
    editPanelClose();
  }
}

function loadJournal(searchQuery) {
  localStorage.setItem('myJournal', JSON.stringify(journal));
  
  console.warn("LOADING JOURNAL", journal);
  clearDropDown();
  const template = document.getElementById("categoryTemplate");
  const main = document.getElementById("main");
  const journalName = document.getElementById("journalName");
  journalName.value = journal.title;

  
  const panel = document.getElementById("editPanel");
  panel.style.width = 0 + "px"
  
  
  const lockIcons = document.querySelectorAll(".icon-lock");
  if (journalPassword.length > 0) {
    lockIcons.forEach((icon) => {
      icon.style.display = "block";
    });
  } else {
    lockIcons.forEach((icon) => {
      icon.style.display = "none";
    });
  }
  const elements = main.querySelectorAll(".category");

  let entryLists = {
    
  }
  for (let i = 0; i < journal.categories.length; i++) {
    const v = journal.categories[i];
    const clone = document.importNode(template.content, true);
    const label = clone.querySelector("label");
    const entryList = clone.querySelector(".entryList");
    label.textContent = v.topic;
    
    entryLists[i] = entryList;

    label.addEventListener("click", function (event) {
      const rect = this.getBoundingClientRect();
      const afterWidth = 20;
      const afterHeight = 20;

      // the position of the ::after pseudo-element
      const afterX = rect.right - afterWidth - 10; // 10px right offset
      const afterY = rect.top + 10; // 10px top offset

      // if the click was within the bounds of the ::after pseudo-element
      if (
        event.clientX >= afterX &&
        event.clientX <= afterX + afterWidth &&
        event.clientY >= afterY &&
        event.clientY <= afterY + afterHeight
      ) {
        this.classList.toggle("rotate-90");
        const dropdownElement = document.createElement("div");
        dropdownElement.classList.add("dropDown");
        dropdownElement.appendChild(
          newDButton("rename category", `renameCatergory(this, ${i})`)
        );
        dropdownElement.appendChild(
          newDButton("delete category", `deleteCategory(this, ${i})`)
        );
        dropdownElement.appendChild(
          newDButton("new entry", `newEntry(this, ${i})`)
        );
        document.body.appendChild(dropdownElement);

        dropdownElement.style.position = "absolute";
        dropdownElement.style.left = `${rect.left + rect.width / 2}px`; // Align with the left side of the element
        dropdownElement.style.top = `${rect.bottom}px`; // Position below the element
        setTimeout(() => {
          dropdownElement.style.height = "100px";
        }, 1);
      }
    });
    main.appendChild(clone);
  }
  
  searchQuery
  let entriesArray = Object.entries(journal.entries);
  if (searchQuery) {
    const filteredEntriesArray = entriesArray.filter(([key, entry]) => {
      return key.toLowerCase().includes(searchQuery.toLowerCase()) || 
             entry.value.toLowerCase().includes(searchQuery.toLowerCase());
    });
    entriesArray =filteredEntriesArray;
  }
  entriesArray.sort((a, b) => {
      return new Date(a[1].date) - new Date(b[1].date);
  });

  const AlreadyStores = {};
  for (const [name, entry] of entriesArray) {
   
    if (!AlreadyStores[entry.category] || !AlreadyStores[entry.category].includes(entry.date)) {
      const dateContainer = document.getElementById('date-container');
      const header = document.createElement('div');
      header.className = 'date-header';
      
      const dateText = document.createElement('span');
      dateText.textContent = formatMonthDate(entry.date);
      dateText.className = 'highlight';

      header.appendChild(dateText);
      entryLists[entry.category].appendChild(header);
        
      // store the date in AlreadyStores for that category
      if (!AlreadyStores[entry.category]) {
          AlreadyStores[entry.category] = []; // init if it not exist
      }
      AlreadyStores[entry.category].push(entry.date); // add the date to the category
    }
    
    const button = document.createElement("button");
    button.className = "entry";
    button.addEventListener('click', () => {
      entryPanel(name);
    })
    
    const entryTitle = document.createElement("label");
    entryTitle.className = "entryTitle"
    entryTitle.textContent = name;
    button.appendChild(entryTitle);
    
    const entryDateLabel = document.createElement("label");
    entryDateLabel.className = "entryDate"

    const weekIndex = getWeekIndex(entry.date)
    entryDateLabel.innerHTML = `
      ${weekIndex[0]}
      <div style="border-bottom: 1px solid #372f45; width: 50%; margin: 2px auto; display: block;"></div>
      ${weekIndex[1]}
    `;
    button.appendChild(entryDateLabel);
      
    entryLists[entry.category].appendChild(button)
  }
  
  elements.forEach((element) => {
    element.remove();
  });
}

document.addEventListener("DOMContentLoaded", function () {
  
  const journalData = localStorage.getItem('myJournal');
  if (journalData) {
    journal = JSON.parse(journalData)
  }
  loadJournal();
  
  const cmHolder = document.querySelector('.cm-holder');
  cmHolder.addEventListener('input', function() {
    if (editingEntry) {
      const entry = journal.entries[editingEntry]
      const content = cmHolder.innerHTML;
      entry.value = content
      
      localStorage.setItem('myJournal', JSON.stringify(journal));
    }
  })
  
  const editPanelDate = document.querySelector('#editPanelDate');
  editPanelDate.addEventListener("change", function(event) {
    if (editingEntry) {
      const oldDate = journal.entries[editingEntry].date;
      const selectedDate = event.target.value;
      journal.entries[editingEntry].date = selectedDate;
      console.log("Selected date:", selectedDate);
      if (oldDate != selectedDate) {
        loadJournal();
      }
    }
  })
  
  const editPanelTitle = document.querySelector('#editPanelTitle');
  editPanelTitle.addEventListener("blur", () => {
    const oldKey = editingEntry;
    const newKey = editPanelTitle.value;
    
    if (newKey === "") {
      const confirmed = confirm("The title is empty. Do you want to delete this entry?");
      if (confirmed) {
        delete journal.entries[oldKey];
        loadJournal();
      }
    } else {
      if (newKey != oldKey) {
        journal.entries[newKey] = journal.entries[oldKey];
        delete journal.entries[oldKey];

        loadJournal();
      }
    }
  });

  editPanelTitle.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      editPanelTitle.blur(); // unfocus
    }
  });
});

function titleInput(elm) {
  const string = String(elm.value);
  const newString = string.length > 32 ? string.substring(0, 32) : string;
  journal.title = newString;
  elm.value = newString;
}

function exportJournal(elm, id) {
  let name = journal.title;
  if (name.length > 0) {
  } else {
    name = "Untitled"
  }
  if (id == 1) {
    const newJson = JSON.stringify({ file: "journal", data: journal }, null, 2);
    downloadTxt(newJson, name + "_journal.txt");
  } else if (id == 2) {
    const jsonString = JSON.stringify(journal);
    const encJson = xorEncryptDecrypt(jsonString, journalPassword);
    const newJson = JSON.stringify({ file: "journalEnc", data: encJson }, null, 2);
    downloadTxt(newJson, name + "_journal.enc");
  }
}

function loadFile(elm) {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".txt, .enc";
  fileInput.style.display = "none"; // hide

  document.body.appendChild(fileInput);

  fileInput.addEventListener("change", function (event) {
    const files = event.target.files; // get the selected files

    if (files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = function (e) {
        const fileContent = e.target.result;
        try {
          const jsonContent = JSON.parse(fileContent);
          console.log(`File content: `, jsonContent);
          if (jsonContent.file === "journal" && jsonContent.data) {
            journalPassword = "";
            journal = jsonContent.data;
            loadJournal();
          } else if (jsonContent.file === "journalEnc" && jsonContent.data) {
            console.log("REQUEST KEY(password)!!")
            
            const input = document.createElement("input");
            input.type = "password";
            input.placeholder = "Enter file password";
            
            elm.replaceWith(input);
            input.focus();

            function attemptKey(key) {
              try {
                const toParse = xorEncryptDecrypt(jsonContent.data, key);
                return JSON.parse(toParse); // parse was successful
              } catch (error) {
                return undefined; // parse failed
              }
            }
            
            input.addEventListener("blur", () => {
              const attemptPassword = input.value;
              const attemptedJSON = attemptKey(attemptPassword);
              if (attemptedJSON) { // succesfull json
                journalPassword = attemptPassword;
                journal = attemptedJSON
                loadJournal();
              } else {
                alert("wrong password")
              }
              input.value = "";
            });

            input.addEventListener("keypress", (event) => {
              if (event.key === "Enter") {
                input.blur(); // unfocus
              }
            });
            
          } else {
            alert("could not load file")
            loadJournal();
          }
        } catch (err) {
          alert(err);
          loadJournal();
        }
      };
      reader.readAsText(file);
    }
  });

  fileInput.click();
  
  document.body.removeChild(fileInput);
}

function navButton(elm, id) {
  console.log(elm, id);

  if (elm.classList.contains("active")) {
    elm.classList.remove("active");
    document.querySelectorAll(".dropDown").forEach((element) => {
      element.style.height = "0px";
      setTimeout(() => {
        element.remove();
      }, 300);
    });
    return; // Exit the function if it's already active
  }

  document
    .querySelectorAll(".navbutton")
    .forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".dropDown").forEach((element) => {
    element.style.height = "0";
    setTimeout(() => {
      element.remove();
    }, 300);
  });

  elm.classList.toggle("active");

  const dropdownElement = document.createElement("div");
  let dropdownSize = 60;
  dropdownElement.classList.add("dropDown");

  if (id == 1) {
    dropdownElement.appendChild(newDButton("new entry", "makeEntry(this)"));
    dropdownElement.appendChild(
      newDButton("new category", "makeCategory(this)")
    );
    dropdownElement.appendChild(newDButton("new journal", "newJournal(this)"));
    dropdownSize = 90;
  } else if (id == 2) {
    dropdownElement.appendChild(newDButton("save", "save(this)"));
    dropdownElement.appendChild(newDButton("save as", "saveAs(this)"));
  } else if (id == 3) {
    dropdownElement.appendChild(newDButton("from file", "loadFile(this)"));
  } else if (id == 4) {
    // CALENDAR
  } else if (id == 5) {
    dropdownElement.appendChild(newDButton("refresh", "loadJournal()"));
    dropdownElement.appendChild(
      newDButton("add/change password", "changePassword(this)")
    );
    
    dropdownElement.appendChild(newDButton("Export as Txt", "exportJournal(this, 1)"));
    dropdownElement.appendChild(
      newDButton("Export as Encrypted (password)", "exportJournal(this, 2)")
    );
    
    dropdownElement.appendChild(newDButton("print", "printPage()"));
    dropdownSize = 150;
  }

  document.body.appendChild(dropdownElement);
  const rect = elm.getBoundingClientRect();
  dropdownElement.style.position = "absolute";
  dropdownElement.style.left = `${rect.left}px`; // Align with the left side of the element
  dropdownElement.style.top = `${rect.bottom}px`; // Position below the element
  setTimeout(() => {
    dropdownElement.style.height = dropdownSize + "px";
  }, 1);
}

function searchInput(searchLabel) {
  console.log("SERACHING:",searchLabel.value)
  editPanelClose()
  loadJournal(searchLabel.value)
}

function printPage() {
  clearDropDown();
  window.print();
}

function deleteEntry(button) {
  const input = document.getElementById("editPanelTitle");
  input.focus();
  input.value = ""; 
  input.blur();
}

function newJournal() {
  const isYes = confirm("are you sure you want to make a new Journal")
  clearDropDown();
  if (isYes) {
    journal = journal = {
      author: "",
      title: "",
      creationTimestamp: getTimeSt(),
      categories: [
      ],
      entries: {
      }
    }
    loadJournal();
  }
}

function save() {
  localStorage.setItem('myJournal', JSON.stringify(journal));
  clearDropDown();
}

async function saveAs() {
  const fileHandle = await window.showSaveFilePicker({
    types: [
      {
        description: "Text and Enc Files",
        accept: {
          "text/plain": [".txt"],
          "application/octet-stream": [".enc"],
        },
      },
    ],
  });

  // writable stream to handle file stuff
  const writableStream = await fileHandle.createWritable();

  const data = JSON.stringify(journal, null, 2);

  await writableStream.write(data);
  await writableStream.close();

  clearDropDown();
}

document.addEventListener("click", function (event) {
  // mouse click
  if (
    event.target.tagName != "BUTTON" &&
    event.target.tagName != "LABEL" &&
    event.target.tagName != "INPUT"
  ) {
    clearDropDown();
  }
});