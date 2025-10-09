# [provatorov.ru](https://provatorov.ru/)

Web app showcasing the photography of my father, Alexander Provatorov — explorer and photographer. Built to browse and download high-resolution photos with search, sorting, favorites, and detailed metadata for each shot. Created as a personal experiment with HTML, CSS, and JavaScript.

![Gallery page](https://github.com/user-attachments/assets/fe1dd7e4-4187-4896-8c62-9366ce323b1e)  
Gallery page — browse all photos with search, sorting, and favorites.

![Photo page](https://github.com/user-attachments/assets/751bf86a-c009-4326-9a99-a4e633dd9274)  
Photo page — view a single photo, explore metadata, see similar shots, and download in HQ.

## Features
- Browse a collection of photos from around the world
- Search by year, country, region, camera, or tags
- Sort photos by name or year
- Shuffle the gallery for new inspiration
- Add to favorites
- Download photos in high resolution
- View similar photos by region or country
- Learn about the author — dedicated page with biography and visited countries
- Persistent state — pages remember your search and scroll position
- Modal error messages — display user-friendly notifications when something goes wrong
- “Liquid glass” UI with soft blur and ambient gradients

## Built With
- HTML5 — semantic structure for all pages
- CSS3 — responsive layout with minimal design
- Vanilla JavaScript + ES Modules — modular architecture for gallery rendering, search, sorting, and state management
- JSON data source — contains metadata and file paths for each photo
- Yandex S3 Storage + CDN — hosts and delivers HQ photo files via cached endpoints for faster load times
- Three-tier image system — thumb, web, and hq versions optimized for performance
- LocalStorage & SessionStorage — preserve favorites and restore browsing state
- GitHub Pages — static hosting with custom domain

## Roadmap
- React + TypeScript rewrite — planned migration to a modern component-based architecture
- Weekly photo updates — new photos will be added to the gallery every week
- Improved performance — optimize loading and rendering
