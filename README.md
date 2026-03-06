# ⚡ PowerSense AI — Holographic Smart Campus Energy Optimizer

> An immersive, AI-driven smart energy system featuring a **React Three Fiber 3D holographic command table**, machine learning occupancy prediction, and a simulated temporal energy grid.

---

## 🚀 Key Features

### 1. 🖥️ Holographic 3D Command Table
- Fully interactive **3D Campus Map** built with `react-three-fiber` and `three.js`.
- Glowing neon wireframes, floating UI tags (`@react-three/drei` Html), and a cinematic bloom post-processing pipeline.
- Real-time animated **energy streams** (particles moving along bezier curves) connecting the central power nexus grid to each classroom block.

### 2. 🧠 AI Occupancy Prediction (Scikit-Learn)
- A highly accurate **RandomForest Classifier** predicts if a room is occupied based on the hour, day of the week, timetable schedule, and real-time WiFi devices active.
- **Trained on Real Data**: The model is trained on `campus_energy_data.csv`, a historical dataset representing actual campus patterns, allowing it to accurately predict real-world schedules rather than using hardcoded logic.
- Analyzes current occupancy + a **30-minute lookahead prediction**.
- Recommends one of three actions: `Keep Power On`, `Reduce Power` (AC/Fans OFF), or `Turn Off All`.

### 3. ⏳ Time-Scrubbing Energy Simulation
- A custom Python simulation engine acting as a live campus!
- **Interactive Scrubber**: The dashboard has an interactive timeline slider that lets administrators drag to "time travel" through the day.
- Fast-forward speed controls (1x, 2x, 4x) to simulate full-day energy cycles. 
- Real-time calculations of kWh saved, Cost saved, and **CO₂ Reduced (Green impact)**.

### 4. 🎛️ Tactical Data Overlays
- **Floating HUD Glass Panels**: Overlapping the R3F scene.
- **Neon LED Equalizer**: A cool CSS-based LED equalizer visualizing live power consumption per room against total capacity.
- **Efficiency Heatmap**: Displays accurate real-time energy efficiency percentages. The math is simple but effective: `100% - (current_power / max_possible_capacity)`. If the room is physically occupied but the AI turns off the AC, efficiency skyrockets!
- **Historical Busy Heatmap**: Toggle between the live efficiency maps and historical schedule grids for 12-hour block insights.
- **Faculty Override**: A manual toggle that forces the simulation to re-route energy back into a room, overriding the AI.

---

## 💻 Tech Stack
- **Frontend**: React, Vite, React Three Fiber, Three.js, GSAP, Postprocessing
- **Backend**: Python, FastAPI, Uvicorn 
- **AI/ML**: Scikit-Learn (RandomForest), Pandas, Numpy
- **Database**: SQLite
- **Styling**: Vanilla CSS with modern Glassmorphism & Cyberpunk Neon tokens

---

## 🛠️ Installation & Setup (For Teammates & Developers)

Since data files and trained models are `.gitignore`d to keep the repository lightweight, you will need to generate the local database and train the AI model on your machine after cloning.

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/powersense-ai.git
cd powersense-ai
```

### 2. Dataset Setup
1. Download the **UCI Household Power Consumption** dataset (or use the provided hackathon asset `campus_energy_data.csv`).
2. Create a folder named `Data_set` in the root of the project.
3. Place the dataset inside it and ensure it is named `Electricity_consumption.txt` (or update the path in `backend/data_processor.py`).

Your folder structure should look like this:
```text
/powersense-ai
  ├── Data_set/
  │    └── Electricity_consumption.txt
  ├── backend/
  └── frontend/
```

### 3. Backend & AI Setup
Open a terminal and navigate to the `backend` folder:

```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

**Generate the Database:**
Run the data processor to parse the raw dataset and synthetically generate the classroom environments into a local SQLite database (`powersense.db`):
```bash
python data_processor.py
```

**Train the AI Model:**
Run the model script to train the RandomForest classifier and save it as `occupancy_model.joblib`:
```bash
python model.py
```
*(Note: If you skip this step, running `main.py` will automatically train the model on the first request.)*

**Start the Server:**
```bash
python main.py
```
*The FastAPI backend will now be running on `http://localhost:8000`*

### 4. Frontend Setup
Open a **new** terminal window and navigate to the `frontend` folder:
```bash
cd frontend
npm install
npm run dev
```
*The Holographic Dashboard will be available at `http://localhost:5173`*

---

## 📡 API Endpoints (FastAPI)
- `GET /api/rooms` - Live status of all 8 campus blocks.
- `GET /api/predictions` - Current & 30-min AI predictions + WiFi traffic.
- `GET /api/energy-usage` - Power consumption (kW), capacity, and efficiency.
- `GET /api/stats` - Total energy saved, costs, and carbon offset.
- `POST /api/simulate` - Advance or scrub time (`{"action": "set_time", "time_iso": "..."}`).
- `POST /api/override` - Manual faculty override.
