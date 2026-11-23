# 🍽️ Zomato Predictive Analytics & Dynamic Dashboard Tool (MERN Stack)

A full-fledged, upload-driven MERN stack application built for Zomato data analysis, machine learning predictions, and restaurant administration.

---

## 🌟 Key Features

### 1. 📁 Dynamic CSV Upload & Instant Dashboard Generation
- **Drag-and-drop any CSV file** (or click to browse).
- **Auto-type detection**: Automatically inspects columns to categorize them as **numeric** (ratings, votes, cost) or **categorical** (restaurant type, online delivery, table booking).
- **Cleans edge cases**: Gracefully handles `"4.1/5"`, `"3.8 /5"`, `"1,200"` price commas, and missing values (`"NEW"`, `"-"`).
- **Zero hardcoding**: Visualizations and stats adapt dynamically to whatever dataset is uploaded.

### 2. 🎯 Answers All 6 Core Business / EDA Questions Interactively
The dashboard automatically detects Zomato columns and answers the 6 strategic questions:
1. **What type of restaurant do the majority of customers order from?** (Category distribution & top type)
2. **How many votes has each type of restaurant received from customers?** (Aggregated vote distribution by type)
3. **What are the ratings that the majority of restaurants have received?** (Rating frequency & mode analysis)
4. **What is couples' average spending on each online order?** (Average of `approx_cost(for two people)` for `online_order == 'Yes'`)
5. **Which mode (online or offline) has received the maximum rating?** (Online vs Offline average & max satisfaction comparison)
6. **Which type of restaurant received more offline orders (target for discounts)?** (Offline order counts by type to convert customers)

### 3. 🔮 Predictive ML Engine
- **Multivariate Linear Regression**: Predict ratings, votes, or average cost based on user-selected input features with R² score and feature importance.
- **Trend Analysis & Forecasting**: Computes rolling moving averages and projects future values using linear extrapolation.
- **K-Nearest Neighbors Classification**: Predicts categorical attributes with confidence percentage and nearest neighbor matching.

### 4. ⚙️ Admin Panel
- Interactive DataTable with search, sort, and pagination.
- Full CRUD: Add new restaurant rows, inline edit existing records, delete entries.
- Export modified datasets back to CSV anytime.

---

## 🚀 How to Run

### Quick Start (Windows)
Double click `start.bat` in the project root, or run:
```bash
./start.bat
```

### Manual Start

**Backend (Port 5000):**
```bash
cd server
npm start
```

**Frontend (Port 5173):**
```bash
cd client
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## 🏗️ Project Architecture

```
Zomato_Tool/
├── package.json             # Root workspace runner
├── start.bat                # One-click Windows starter
├── server/
│   ├── index.js             # Express app & sample auto-seeder
│   ├── store.js             # In-memory dataset store
│   ├── sample_data.csv      # Auto-seeded sample data (from your upload)
│   └── routes/
│       ├── upload.js        # CSV upload & schema detector
│       ├── analytics.js     # Distributions, correlations, Zomato 6-question insights
│       ├── predict.js       # ML regression, trends, KNN classifier
│       └── admin.js         # Row CRUD & CSV export
└── client/
    ├── src/
    │   ├── api.js           # Axios API layer
    │   ├── App.jsx          # React Router & layout
    │   ├── components/      # Sidebar, ChartCard, StatsCard, Modal
    │   └── pages/
    │       ├── UploadPage.jsx    # CSV Drag & Drop landing page
    │       ├── DashboardPage.jsx # Dynamic Charts & 6 Questions Dashboard
    │       ├── PredictPage.jsx   # Linear regression, trends, classification
    │       └── AdminPage.jsx     # DataTable CRUD & CSV exporter
```

