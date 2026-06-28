# RedNote Image Copy Helper小红书中文图文复制插件

A Tampermonkey userscript that helps users copy note text and download images from RedNote/Xiaohongshu pages more efficiently.

Screenshot will be added later.

## Features

* Detects images on RedNote/Xiaohongshu pages
* Supports downloading the current visible image
* Supports downloading all loaded large images, up to 30 images per action
* Only downloads images from the currently opened note detail page
* Avoids downloading all images from the homepage feed
* Supports copying image links
* Supports copying note text, including title, author, publish time, content, and page URL
* Writes both `text/html` and `text/plain` when copying note text, making it easier to paste into Word or AI tools
* Generates image filenames from the note title when available
* Provides a draggable floating control panel
* Supports hiding and showing the control panel
* Supports language switching between Chinese and English
* Supports automatic light/dark theme matching the RedNote/Xiaohongshu page
* Provides a copyable Probe JSON report for debugging page structure
* Remembers panel position and hidden state across page reloads
* Improves the workflow for collecting visual references and note materials
* Runs directly in the browser through Tampermonkey

## Use Case

This tool was built to improve the efficiency of content research and visual asset collection on RedNote/Xiaohongshu. It is designed for personal productivity, content analysis, and research-oriented workflows.

## Installation

1. Install Tampermonkey in your browser.
2. Open the `rednote-image-copy-helper.user.js` file from this repository.
3. Click `Raw`.
4. Tampermonkey should detect the script and open the installation page.
5. Click `Install`.

## Usage

1. Open a RedNote/Xiaohongshu note page.
2. Use the floating panel to:

   * Copy note text
   * Download the current image
   * Download all loaded images
   * Copy image links
   * Copy Probe JSON for debugging

3. Drag the panel to any position on the page.
4. Hide or show the panel when needed.
5. Open `Settings` to switch language or choose `Auto`, `Light`, or `Dark` theme.

The image actions are scoped to the currently opened note detail page. If you are on the homepage feed without an opened note detail view, the script will ask you to open a note first instead of downloading feed images.

## Disclaimer

This project is for personal learning and productivity purposes only. Please respect platform terms of service, copyright rules, and the rights of content creators. This project is not affiliated with RedNote/Xiaohongshu.

## Tech Stack

* JavaScript
* Tampermonkey Userscript
* Browser DOM Manipulation

## Author

xL.
