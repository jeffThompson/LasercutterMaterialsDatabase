let url;

// get the material id from the current url
// via: https://stackoverflow.com/a/901144/1167783
const params = new Proxy(
  new URLSearchParams(window.location.search), 
  { get: (searchParams, prop) => searchParams.get(prop) }
);
let material_id = params.material_id;

// load settings file (mostly for the csv file
// and info that shows up in the footer)
// (an ugly async to avoid an even uglier cascade
// of request/wait/load)
async function applySettings() {
  try {
    const response = await fetch('settings.json');
    const json = await response.json();
    url = json.csv;
    let html = json.location;
    if (json.institution) {
      html += ' &bull; ' + json.institution;
    }
    document.getElementById('where').innerHTML = html;
    document.getElementById('spreadsheet-url').href = json.spreadsheetURL;

    // then load csv data
    loadData();
  }
  catch(error) {
    console.log(error.message);
  }
}
applySettings();

// get csv file from sheets
// then get the data for that material
// https://www.papaparse.com/docs
function loadData() {
  Papa.parse(url, {
    header: true,
    download: true,
    complete: function(results) {
      results = parseCSV(results.data);
      let row = results[material_id];
      if (row === undefined) {
        document.getElementById('nav').remove();
        document.getElementById('material-data').remove();
        displayIndex(results);
        return;
      }
      updatePage(row);

      // generate qr code filename and the image itself
      let qrFilename = row['material-id'];
      qrFilename += '-' + toTitleCase(row.material);
      if (row.finish) {
        qrFilename += '-' + toTitleCase(row.finish);
      }
      if (row.color) {
        qrFilename += '-' + toTitleCase(row.color);
      }
      if (row['listed-thickness']) {
        let t = row['listed-thickness'];
        t = t.replaceAll('"', 'in');
        t = t.replaceAll('\'', 'ft');
        qrFilename += '-' + toTitleCase(t);
      }
      qrFilename += '.png';
      qrFilename = qrFilename.replace(/\s+/g, '');
      generateQR(qrFilename);
    },
    error: function(error) {
      console.log(error);
    }
  });
}

// display an index of all materials
// - if material not found or none listed
function displayIndex(d) {
  let list = document.createElement('section');
  list.id = 'material-index';

  let square = document.createElement('div');
  square.id = 'square';
  list.append(square);

  let header = document.createElement('h1');
  header.innerHTML = 'MATERIALS';
  list.appendChild(header);

  let p = document.createElement('p');
  p.id = 'index-note';
  p.innerHTML = 'Pick from this list or scan the QR code on the material sample';
  list.appendChild(p);

  for (let [id, row] of Object.entries(d)) {
    let html = '<a href="?material_id=' + id + '">';
    html += '<span class="index-id">#' + id + ':</span>';
    html += row.material + ' (';

    if (row.color) {
      html += row.color + ', ';
    }
    if (row.finish) {
      html += row.finish + ', ';
    }
    html += row['listed-thickness'];
    html += ')</a>';
    let p = document.createElement('p');
    p.innerHTML = html;
    list.appendChild(p);
  }
  let wrapper = document.getElementById('wrapper');
  wrapper.prepend(list);
}

// cleans up the csv dict
// - keys made lowercase
// - spaces in header replaced w dash
function parseCSV(csv) {
  let out = {};
  for (let [key, value] of Object.entries(csv)) {
    let id = value['MATERIAL ID'];
    for (let key in value) {
      let newKey = key.toLowerCase();
      let newValue = value[key];
      newKey = newKey.replaceAll(/\s+/g, '-');  // spaces to dashes
      delete value[key];
      value[newKey] = newValue;
    }
    out[id] = value;
  }
  return out;
}

// https://stackoverflow.com/a/196991/1167783
function toTitleCase(str) {
  return str.replace(
    /\w\S*/g,
    function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
  );
}

// add leading zeroes to number
function pad(n, numDigits) {
  let zeroes = '0'.repeat(numDigits)
  return(zeroes + n).slice(-numDigits);
}

// update the html on the page with the material info
function updatePage(d) {
  document.getElementById('nav').style.display = 'inherit';
  document.getElementById('material-data').style.display = 'inherit';

  // update nav
  document.getElementById('prev').href = '?material_id=' + pad(parseInt(d['material-id']) - 1, 3);
  document.getElementById('next').href = '?material_id=' + pad(parseInt(d['material-id']) + 1, 3);

  // material info
  document.querySelector('#material .data').innerHTML = d.material;
  document.querySelector('#material-id .data').innerHTML = '#' + d['material-id'];

  if (d.finish) {
    document.querySelector('#finish .data').innerHTML = d.finish;
  }
  else {
    document.getElementById('finish').remove();
  }
  if (d.color) {
    document.querySelector('#color .data').innerHTML = d.color;
  }
  else {
    document.getElementById('color').remove();
  }

  let preset = '';
  let indent = 1;
  for (let i=0; i<d.preset.length; i++) {
    let c = d.preset.substr(i, 1);
    if (c === '>') {
      preset += '<br>' + '&nbsp;'.repeat(indent) + '&rdsh;';
      indent += 1;
    }
    else {
      preset += c;
    }
  }
  document.querySelector('#preset .data').innerHTML = preset;

  document.querySelector('#listed-thickness .data').innerHTML = d['listed-thickness'];
  document.querySelector('#actual-thickness .data').innerHTML = d['actual-thickness'];

  document.querySelector('#raster .data').innerHTML = addPlusSign(d.raster);
  document.querySelector('#vector .data').innerHTML = addPlusSign(d.vector);
  document.querySelector('#cut    .data').innerHTML = addPlusSign(d.cut);

  document.querySelector('#transfer-tape .data').innerHTML = d['needs-transfer-tape'];

  let vendor = '<a href="' + d.url + '" target="_blank">' + d.vendor + '</a>';
  document.querySelector('#vendor .data').innerHTML = vendor;
  document.querySelector('#price .data').innerHTML = d['price'];

  if (d.notes) {
    if (d.notes.includes('•')) {
      let html = createList(d.notes, '•', 'notes-list');
      document.querySelector('#notes .data').innerHTML = html;
    }
    else {
      document.querySelector('#notes .data').innerHTML = d.notes;
    }
  }
  else {
    document.getElementById('notes').remove();
  }
  
  if (d.warnings) {
    if (d.warnings.includes('•')) {
      let html = createList(d.warnings, '•', 'warnings-list');
      document.querySelector('#warnings .data').innerHTML = html;
    }
    else {
      document.querySelector('#warnings .data').innerHTML = d.warnings;
    }
  }
  else {
    document.getElementById('warnings').remove();
  }
}

// build a list from a string, using a character
// (like •) to note new list items
function createList(str, charToMatch, className) {
  let html = '<ul class="' + className + '">';
  for (item of str.split(charToMatch)) {
    if (!item) continue;
    html += '<li>' + item.trim() + '</li>';
  }
  html += '</ul>';
  return html;
}

// add a plus sign if number is positive (and not zero)
function addPlusSign(s) {
  if (!s || s === '0') {
    return '(no change)';
  }
  if (parseFloat(s) > 0) {
    return '+' + s;
  }
  return s;
}

// generate a qr code to this page
// - also includes a download link for printing
// https://github.com/davidshimjs/qrcodejs
function generateQR(filename) {
  let canvas = document.getElementById('qr');
  let qr = new QRCode(
    canvas,
    {
      text:        window.location.href,
      width:       150,
      height:      150,
      colorDark:   '#000000',
      colorLight:  '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.H
    }
  );
  let dl = document.querySelector('#download a');
  dl.href = document.querySelector('canvas').toDataURL('image/png');
  dl.download = filename;
}

