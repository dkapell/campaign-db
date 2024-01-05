#!/bin/bash

# build assorted templates for client side
# Skills
./node_modules/pug-cli/index.js -c --name newFormTemplate -o public/javascripts/templates/skill views/skill/modalNewForm.pug
./node_modules/pug-cli/index.js -c --name editFormTemplate -o public/javascripts/templates/skill views/skill/modalEditForm.pug

# Characters
./node_modules/pug-cli/index.js -c --name-after-file -o public/javascripts/templates/character views/character/templates/*.pug
./node_modules/pug-cli/index.js -c --name-after-file -o public/javascripts/templates views/clientPartials/*.pug

# Reports
./node_modules/pug-cli/index.js -c --name-after-file -o public/javascripts/templates/report/group views/report/templates/group/*.pug
./node_modules/pug-cli/index.js -c --name-after-file -o public/javascripts/templates/report/skill views/report/templates/skill/*.pug
