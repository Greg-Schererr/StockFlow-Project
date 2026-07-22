# StockFlow

StockFlow is a minimalist inventory management system created as a portfolio project. It simulates a practical business application for registering products, controlling stock movements and monitoring inventory health.

## Highlights

- Dashboard with operational indicators
- Product registration and editing
- Stock entry and removal workflow
- Search, category, status and sorting filters
- Low-stock and out-of-stock alerts
- Supplier and storage-location information
- Complete movement history with notes
- CSV export of the filtered inventory
- REST API with backend validation
- SQLite database with automatic setup
- Responsive interface built without frontend frameworks

## Technologies

- HTML5
- CSS3
- JavaScript
- Node.js
- Express
- SQLite
- Git and GitHub

## Project structure

```text
stockflow/
├── data/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── database.js
│   └── server.js
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

## Running locally

Requirements:

- Node.js 18 or newer
- npm

```bash
git clone https://github.com/Greg-Scherer/stockflow.git
cd stockflow
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

The database and demonstration data are created automatically on the first run.

## Main API routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/dashboard` | Dashboard metrics and analytics |
| GET | `/api/meta` | Available categories and suppliers |
| GET | `/api/products` | Product list with filters and sorting |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/:id` | Update product information |
| DELETE | `/api/products/:id` | Delete a product |
| GET | `/api/movements` | Full stock movement history |
| POST | `/api/products/:id/movements` | Register a stock entry or removal |
| GET | `/api/health` | Application health check |

## Business rules

- Product SKUs must be unique.
- Stock cannot become negative.
- Inventory quantity changes are registered through stock movements.
- Products at or below their minimum stock are marked as low stock.
- Products with zero quantity are marked as out of stock.

## Future improvements

- Authentication and role-based access
- Automated tests
- PDF reports
- Audit log
- Cloud deployment
- PostgreSQL production database

## Author

**Grégori Scherer dos Santos**

- GitHub: [Greg-Scherer](https://github.com/Greg-Scherer)
- Email: gregori3schererr@gmail.com

## License

Licensed under the MIT License.
