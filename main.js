

const { app, dialog } = require('electron');
const Seven = require('node-7z');
const exec = require('child_process').exec;

async function streamToJSON(readableStream) {
  const chunks = [];
  return new Promise((resolve,reject) => {
    readableStream.on('data', (chunk) => chunks.push(chunk));
    readableStream.on('error', (err) => reject(err));
    readableStream.on('end', () => resolve(chunks));
  })
}

// Initialize the Electron app
app.whenReady().then(() => {
  // launch dialog to select a .zip/.7z file
  dialog.showOpenDialog({
    title: 'Select a file',
    properties: ['openFile'],
    filters: [
		// TODO: add the filters for the extensions I need
      { name: 'All Files', extensions: ['*'] },
      // You can add more filters if needed
    ],
  })
  .then(async (result) => {
    let selectedFile = '';
    if (!result.canceled) {
      selectedFile = result.filePaths[0];
      console.log(`Selected file: ${selectedFile}`);
    } else {
      console.log('File selection canceled');
	  app.quit();
    }

    // get the size of uncompressed contents
    const contentStream = Seven.list(selectedFile);
    const zipContents = await streamToJSON(contentStream);
    console.log('------------Archive Contents------------')
    console.log((Object.assign({}, zipContents)));
    let size = 0;
    for(const item of zipContents){
      size += item.size;
    }
    console.log('Total size: ', size);

    // create the ramdisk with that size using imdisk
    try {
      const cmdString = `imdisk -a -s ${((size/1000000)+10).toFixed(0)}M -m Z: -p "/fs:ntfs /q /y"`;

      exec(cmdString, (error, stdout, stderr) => { console.log(stdout) });

      console.log('Finished creating and formatting RAM disk')
    } catch(e) {
      console.log('Error while creating RAM disk: ', e.toString());
    }

    // unzip the .zip/.7z into the root of the ram disk under a folder of the zip name
    const myStream = Seven.extract(selectedFile, 'Z:/', {
      recursive: true
    });

    myStream.on('data', function (data) {
      console.log(data);
    })
    myStream.on('progress', function (progress) {
      console.log(progress);
    })
    myStream.on('end', function() {
      console.log('Extracted')
    })
    myStream.on('error', (err) => console.log('ZIP extraction failed: ', err))

    // leave an icon in the taskbar that can be used to quit the process
    // quit out once the icon is selected

    // app.quit();
  })
  .catch((err) => {
    console.error(err);
  });
});

// Handle the app quitting on all platforms
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});