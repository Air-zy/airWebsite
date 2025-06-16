function bitget(num, pos) {
    return num & (1 << pos)
}

function loadData(Obj, sortIndex) {
  function decimalToIP(decimal) {
    let num = parseInt(decimal, 10);
    let octet1 = (num >>> 24) & 255;
    let octet2 = (num >>> 16) & 255;
    let octet3 = (num >>> 8) & 255;
    let octet4 = num & 255;
    return `${octet1}.${octet2}.${octet3}.${octet4}`;
  }
  
  document.body.innerHTML = '';

  // table element
  const table = document.createElement('table');
  table.style = 'width: 100%;border-collapse: collapse;';
  document.body.appendChild(table);

  // header row
  const headerRow = document.createElement('tr');
  const headerCell1 = document.createElement('th');
  headerCell1.textContent = 'IP Address';
  headerCell1.style = 'padding: 10px; border: 1px dotted #ddd;resize:horizontal; overflow:auto;';
  headerRow.appendChild(headerCell1);

  const allKeys = new Set();

  // First, gather all possible keys from all objects in the map
  Object.values(Obj).forEach(sampleObj => {
    Object.keys(sampleObj).forEach(key => {
      allKeys.add(key); // Add all keys to the set (automatically handles duplicates)
    });
  });

  // Now you can iterate through each object in the map
  Object.values(Obj).forEach(sampleObj => {
    allKeys.forEach(key => {
      if (!(key in sampleObj)) {
        sampleObj[key] = null; // Add missing keys with null or a default value
      }
    });
  });

  
  allKeys.forEach(key => {
    const headerCell = document.createElement('th');
    headerCell.textContent = key;
    headerCell.style = 'padding: 10px; border: 1px dotted #ddd;resize:horizontal; overflow:auto;';

    /*headerCell.addEventListener('click', () => {
      //console.log(index)
      loadData(Obj, index)
    });*/

    headerRow.appendChild(headerCell);
  });

  table.appendChild(headerRow);

  Object.entries(Obj).map(([key, value]) => {
    const ip = decimalToIP(key);

    const row = document.createElement('tr');
    const ipCell = document.createElement('td');
    const ipLink = document.createElement('a');
    ipLink.href = `https://check-host.net/ip-info?host=${ip}`;
    ipLink.textContent = ip;
    ipLink.target = '_blank';
    ipLink.style = 'color: white;'
    ipCell.appendChild(ipLink);
    ipCell.style = 'padding: 10px; border: 1px dotted #ddd;';
    row.appendChild(ipCell);

    allKeys.forEach((key2) => {
      const cell = document.createElement('td');
      cell.style = 'padding: 10px; border: 1px dotted #ddd;';
      if (key2 == 'captcha') {
        const val2 = value[key2]
        if (bitget(val2, 0)) {
          cell.textContent = cell.textContent + 'solved captcha, '
        }
        if (bitget(val2, 1)) {
          cell.textContent = cell.textContent + 'post /c, '
        }
        if (bitget(val2, 2)) {
          cell.textContent = cell.textContent + 'footer verify, '
        }
        if (bitget(val2, 3)) {
          cell.textContent = cell.textContent + 'project-view, '
        }
        //cell.textContent = cell.textContent + val2.toString(2) + '|' + val2
      } else {
        cell.textContent = value[key2];
      }
      row.appendChild(cell);
    });

    table.appendChild(row);
  });
}

async function run() {
  const password = prompt("enter password:");
  const requestData = {
    pass: password,
  }
  
  try {
    const response = await fetch('api/console', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    })
    
    if (!response.ok) {
      console.log(response)
      throw new Error(`HTTP ERROR: ${response.status}`);
    }

    const textData = await response.text();
    const jsonData = JSON.parse(textData);

    const binaryData = new Uint8Array(jsonData.buffernew.data);
    const decompressedData = pako.ungzip(binaryData, { to: 'string' });
    const Obj = JSON.parse(decompressedData);
    
    loadData(Obj, -1)
    
  } catch (err) {
    alert(err)
    console.log(err)
  }
}