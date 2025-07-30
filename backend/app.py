import os
import requests
import pandas as pd
import json
import csv
import sys
csv.field_size_limit(sys.maxsize)
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from datetime import datetime
import io
import numpy as np

# Load environment variables from .env file
load_dotenv()

# --- App Configuration ---
static_folder_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
app = Flask(__name__, static_folder=static_folder_path, static_url_path='/')
CORS(app)

# --- Database Configuration ---
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///astra_chat.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)

# --- Configuration ---
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
SAVED_FILES_FOLDER = os.path.join(os.path.dirname(__file__), 'saved_files')
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'json', 'txt'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(SAVED_FILES_FOLDER, exist_ok=True)

# --- Models ---
class ChatSession(db.Model):
    __tablename__ = 'chat_sessions'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    pinned = db.Column(db.Boolean, default=False)
    messages = db.relationship('ChatMessage', backref='session', cascade='all, delete-orphan')

class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_sessions.id'), nullable=False)
    sender = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# --- File Model for Database ---
class UploadedFile(db.Model):
    __tablename__ = 'uploaded_files'
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    saved_path = db.Column(db.String(255), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

# --- API Keys ---
FMP_API_KEY = os.getenv("FMP_API_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

# --- DeepSeek Chat API ---
@app.route('/api/chat', methods=['POST'])
def chat_with_deepseek():
    """
    Main chat endpoint that integrates with DeepSeek API for intelligent responses
    """
    data = request.json
    message = data.get('message', '')
    context = data.get('context', {})
    
    if not message:
        return jsonify({'error': 'No message provided'}), 400

    if not DEEPSEEK_API_KEY:
        return jsonify({'error': 'DeepSeek API key not configured'}), 500

    # Enhanced system prompt for Astra AI
    system_prompt = """You are Astra, a smart voice assistant who speaks naturally like a real AI assistant.

GENERAL MODE:
- Answer all kinds of questions naturally and helpfully
- Provide clear explanations and guidance
- Be conversational and friendly

DATA MODE (when user mentions data-related topics):
- Switch to professional, concise responses
- Focus only on relevant data information
- Avoid unnecessary chit-chat
- Provide actionable data guidance
- Keep responses short and focused

DATA KEYWORDS: upload, dataset, analyze, filter, predict, prediction, data, csv, excel, database, insights, visualization, chart, graph, statistics, metrics, rows, columns, clean, process, transform

When in data mode, be direct and professional. When in general mode, be natural and conversational.

Current context: {context}"""

    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "system",
                "content": system_prompt.format(context=json.dumps(context))
            },
            {
                "role": "user", 
                "content": message
            }
        ],
        "max_tokens": 2000,
        "temperature": 0.7,
        "stream": False
    }
    
    try:
        resp = requests.post(DEEPSEEK_API_URL, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        
        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content']
            
            # Keyword detection for UI triggers
            data_keywords = [
                "upload", "dataset", "analyze", "filter", "predict", "prediction", 
                "data", "csv", "excel", "database", "insights", "visualization", 
                "chart", "graph", "statistics", "metrics", "rows", "columns", 
                "clean", "process", "transform", "help me with data", "work with data"
            ]
            
            user_message_lower = message.lower()
            detected_triggers = []
            
            # Check for specific triggers
            if any(keyword in user_message_lower for keyword in ["upload", "file", "dataset", "csv", "excel"]):
                detected_triggers.append("upload_card")
            
            if any(keyword in user_message_lower for keyword in ["filter", "condition", "where", "rows", "columns"]):
                detected_triggers.append("filter_card")
            
            if any(keyword in user_message_lower for keyword in ["analyze", "analysis", "insights", "visualization", "chart", "graph"]):
                detected_triggers.append("analysis_card")
            
            if any(keyword in user_message_lower for keyword in ["save", "database", "store", "db"]):
                detected_triggers.append("database_card")
            
            # Check if any data keywords are present
            has_data_keywords = any(keyword in user_message_lower for keyword in data_keywords)
            
            response_data = {
                'response': content,
                'model': result.get('model', 'deepseek-chat'),
                'is_data_mode': has_data_keywords,
                'triggers': detected_triggers
            }
            
            return jsonify(response_data)
        else:
            return jsonify({'error': 'Invalid response format from DeepSeek API'}), 500
            
    except requests.exceptions.RequestException as e:
        print(f"DeepSeek API Request Error: {e}")
        return jsonify({'error': f'API request failed: {str(e)}'}), 502
    except Exception as e:
        print(f"Error processing chat request: {e}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

# --- File Upload and Analysis API ---
@app.route('/api/analyze-file', methods=['POST'])
def analyze_uploaded_file():
    """
    Analyze uploaded CSV/Excel files and provide comprehensive insights using only pandas/numpy/sklearn (no DeepSeek)
    """
    import re
    from sklearn.linear_model import LinearRegression
    import warnings
    warnings.filterwarnings('ignore')

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    try:
        # Read the file
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file)
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file)
        else:
            return jsonify({'error': 'Unsupported file format. Please upload CSV or Excel files.'}), 400

        # Comprehensive file analysis
        file_info = {
            'filename': file.filename,
            'rows': len(df),
            'columns': len(df.columns),
            'column_names': df.columns.tolist(),
            'data_types': df.dtypes.apply(lambda x: str(x)).to_dict(),
            'missing_values': df.isnull().sum().to_dict(),
            'missing_percentages': (df.isnull().sum() / len(df) * 100).round(2).to_dict(),
            'total_missing': int(df.isnull().sum().sum()),
            'duplicate_rows': int(df.duplicated().sum()),
            'memory_usage': int(df.memory_usage(deep=True).sum()),
            'sample_data': df.head(10).to_dict('records'),
            'top_5_rows': df.head(5).to_dict('records'),
            'bottom_5_rows': df.tail(5).to_dict('records')
        }

        # Generate statistical analysis for numeric columns
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        statistics = {}
        for col in numeric_columns:
            col_stats = df[col].describe()
            statistics[col] = {
                'count': int(col_stats['count']),
                'mean': float(col_stats['mean']),
                'std': float(col_stats['std']),
                'min': float(col_stats['min']),
                '25%': float(col_stats['25%']),
                '50%': float(col_stats['50%']),
                '75%': float(col_stats['75%']),
                'max': float(col_stats['max'])
            }

        # Generate categorical analysis for non-numeric columns
        categorical_columns = df.select_dtypes(include=['object']).columns
        categorical_stats = {}
        for col in categorical_columns:
            value_counts = df[col].value_counts()
            categorical_stats[col] = {
                'unique_values': int(value_counts.count()),
                'top_values': value_counts.head(5).to_dict(),
                'null_count': int(df[col].isnull().sum())
            }

        # Model suggestions
        model_suggestions = []
        forecast = None
        time_col = None
        target_col = None
        # Try to detect a time/date column
        for col in df.columns:
            if re.search(r'date|time|timestamp', col, re.IGNORECASE):
                try:
                    df[col] = pd.to_datetime(df[col], errors='coerce')
                    if df[col].notnull().sum() > 0:
                        time_col = col
                        break
                except Exception:
                    continue
        # Try to detect a numeric target column (e.g., sales, value, amount)
        for col in numeric_columns:
            if re.search(r'sale|amount|value|price|total|revenue|score|count', col, re.IGNORECASE):
                target_col = col
                break
        if not target_col and len(numeric_columns) > 0:
            target_col = numeric_columns[0]  # fallback to first numeric

        # Suggest models
        if time_col and target_col:
            model_suggestions.append(f"Time-series regression/forecast: {target_col} over {time_col}")
        if len(numeric_columns) >= 2:
            model_suggestions.append("Regression: Predict one numeric column from others")
        if len(categorical_columns) > 0:
            model_suggestions.append("Classification: Predict categorical columns from numeric features")

        # Run enhanced regression/time-series forecast with multiple time ranges
        forecast_results = {}
        if time_col and target_col:
            # Sort by time
            df_sorted = df[[time_col, target_col]].dropna().sort_values(time_col)
            if len(df_sorted) > 10:
                # Use last 30 for training
                df_sorted = df_sorted[-30:]
                X = np.arange(len(df_sorted)).reshape(-1, 1)
                y = df_sorted[target_col].values
                model = LinearRegression()
                model.fit(X, y)
                
                # Calculate prediction confidence (simple approach using residuals)
                y_pred_train = model.predict(X)
                residuals = y - y_pred_train
                std_error = np.std(residuals)
                
                last_date = df_sorted[time_col].iloc[-1]
                freq = pd.infer_freq(df_sorted[time_col]) or 'D'
                
                # Generate forecasts for different time ranges
                time_ranges = {
                    'next_7_days': 7,
                    'next_4_weeks': 28,
                    'next_quarter': 90
                }
                
                for range_name, days in time_ranges.items():
                    future_X = np.arange(len(df_sorted), len(df_sorted) + days).reshape(-1, 1)
                    forecast_values = model.predict(future_X)
                    
                    # Calculate confidence intervals (95% confidence)
                    confidence_margin = 1.96 * std_error
                    upper_bound = forecast_values + confidence_margin
                    lower_bound = forecast_values - confidence_margin
                    
                    future_dates = pd.date_range(start=last_date, periods=days+1, freq=freq)[1:]
                    
                    forecast_data = []
                    for i, (date, val, upper, lower) in enumerate(zip(future_dates, forecast_values, upper_bound, lower_bound)):
                        # Determine trend direction for color coding
                        trend = 'neutral'
                        if i > 0:
                            prev_val = forecast_values[i-1]
                            if val > prev_val * 1.02:  # 2% increase threshold
                                trend = 'increase'
                            elif val < prev_val * 0.98:  # 2% decrease threshold
                                trend = 'decrease'
                        
                        forecast_data.append({
                            'date': str(date.date()),
                            'predicted': float(val),
                            'upper_bound': float(upper),
                            'lower_bound': float(lower),
                            'trend': trend,
                            'confidence': 95.0
                        })
                    
                    forecast_results[range_name] = forecast_data
                
                # Set default forecast to next_7_days for backward compatibility
                forecast = forecast_results.get('next_7_days', [])

        # Enhanced local insights with trend analysis
        insights = []
        
        # Data quality insights
        if file_info['total_missing'] > 0:
            missing_pct = (file_info['total_missing'] / (len(df) * len(df.columns))) * 100
            insights.append(f"Dataset has {file_info['total_missing']} missing values ({missing_pct:.1f}% of total data)")
        if file_info['duplicate_rows'] > 0:
            dup_pct = (file_info['duplicate_rows'] / len(df)) * 100
            insights.append(f"Found {file_info['duplicate_rows']} duplicate rows ({dup_pct:.1f}% of dataset)")
        
        # Statistical insights
        if len(statistics) > 0:
            for col, stats in statistics.items():
                # Detect outliers using IQR method
                q1, q3 = stats['25%'], stats['75%']
                iqr = q3 - q1
                outlier_threshold = 1.5 * iqr
                if stats['max'] > q3 + outlier_threshold or stats['min'] < q1 - outlier_threshold:
                    insights.append(f"Column '{col}' may contain outliers (range: {stats['min']:.2f} to {stats['max']:.2f})")
                
                # Check for skewness
                if stats['std'] > 0:
                    cv = stats['std'] / stats['mean'] * 100
                    if cv > 50:
                        insights.append(f"Column '{col}' shows high variability (CV: {cv:.1f}%)")
        
        # Categorical insights
        if len(categorical_stats) > 0:
            for col, stats in categorical_stats.items():
                if stats['unique_values'] == 1:
                    insights.append(f"Column '{col}' has only one unique value - consider removing")
                elif stats['unique_values'] > len(df) * 0.9:
                    insights.append(f"Column '{col}' has very high cardinality ({stats['unique_values']} unique values)")
                
                # Check for imbalanced categories
                if stats['top_values']:
                    top_value_count = max(stats['top_values'].values())
                    if top_value_count > len(df) * 0.8:
                        insights.append(f"Column '{col}' is highly imbalanced - top category represents {top_value_count/len(df)*100:.1f}% of data")
        
        # Time series insights
        if time_col and target_col:
            df_sorted = df[[time_col, target_col]].dropna().sort_values(time_col)
            if len(df_sorted) > 5:
                recent_avg = df_sorted[target_col].tail(5).mean()
                earlier_avg = df_sorted[target_col].head(5).mean()
                if recent_avg > earlier_avg * 1.1:
                    insights.append(f"'{target_col}' shows an upward trend over time (+{((recent_avg/earlier_avg-1)*100):.1f}%)")
                elif recent_avg < earlier_avg * 0.9:
                    insights.append(f"'{target_col}' shows a downward trend over time ({((recent_avg/earlier_avg-1)*100):.1f}%)")
        
        if not insights:
            insights.append("Dataset appears to be well-structured with no major quality issues detected")

        return jsonify({
            'file_info': file_info,
            'statistics': statistics,
            'categorical_stats': categorical_stats,
            'insights': insights,
            'model_suggestions': model_suggestions,
            'forecast': forecast,
            'forecast_results': forecast_results,
            'status': 'success'
        })

    except Exception as e:
        print(f"Error analyzing file: {e}")
        return jsonify({'error': f'Error analyzing file: {str(e)}'}), 500

# --- Symbol Resolver (ENHANCED) ---
@app.route('/api/resolve-symbol')
def resolve_symbol():
    """
    Resolves a company name (e.g., 'Google') to a valid stock symbol using FMP search API.
    """
    name = request.args.get("name", "")
    if not name or not FMP_API_KEY:
        return jsonify({"symbol": None, "message": "Missing company name or API key."}), 400

    try:
        url = f"https://financialmodelingprep.com/api/v3/search?query={name}&limit=1&apikey={FMP_API_KEY}"
        res = requests.get(url)
        data = res.json()
        if data:
            return jsonify({"symbol": data[0]["symbol"]})
        return jsonify({"symbol": None, "message": "No match found."}), 404
    except Exception as e:
        return jsonify({"symbol": None, "message": str(e)}), 500

# --- Company Data API (ENHANCED - NO MOCK DATA) ---
@app.route('/api/company/<symbol>')
def get_company_data(symbol):
    if not FMP_API_KEY:
        print(f"ERROR: FMP_API_KEY not set in environment variables")
        return jsonify({"status": "error", "message": "Financial data service not configured. Please set FMP_API_KEY in environment variables."}), 500

    try:
        original_symbol = symbol
        # If symbol is not all uppercase or is longer than 5 chars, treat as company name
        if not symbol.isupper() or len(symbol) > 5:
            print(f"Resolving company name '{symbol}' to ticker...")
            search_url = f"https://financialmodelingprep.com/api/v3/search?query={symbol}&limit=1&apikey={FMP_API_KEY}"
            search_response = requests.get(search_url)
            search_response.raise_for_status()
            search_data = search_response.json()
            if search_data and 'symbol' in search_data[0]:
                symbol = search_data[0]['symbol']
                print(f"Resolved '{original_symbol}' to ticker '{symbol}'")
            else:
                print(f"No ticker found for company name: {original_symbol}")
                return jsonify({"status": "error", "message": f"No ticker found for company name: {original_symbol}"}), 404

        print(f"Fetching company data for symbol: {symbol}")
        # --- Get Profile ---
        profile_url = f"https://financialmodelingprep.com/api/v3/profile/{symbol.upper()}?apikey={FMP_API_KEY}"
        profile_response = requests.get(profile_url)
        profile_response.raise_for_status()

        profile_data = profile_response.json()
        if not profile_data:
            print(f"No data found for symbol: {symbol}")
            return jsonify({"status": "error", "message": f"No live data found for symbol: {symbol}"}), 404

        profile_data = profile_data[0]

        # --- Get Ratios ---
        ratios_url = f"https://financialmodelingprep.com/api/v3/ratios-ttm/{symbol.upper()}?apikey={FMP_API_KEY}"
        ratios_response = requests.get(ratios_url)
        ratios_response.raise_for_status()
        ratios_data = ratios_response.json()[0] if ratios_response.json() else {}

        # --- Get Income Statement for revenue data ---
        income_url = f"https://financialmodelingprep.com/api/v3/income-statement/{symbol.upper()}?limit=2&apikey={FMP_API_KEY}"
        income_response = requests.get(income_url)
        income_data = income_response.json() if income_response.status_code == 200 else []

        current_revenue = "N/A"
        previous_revenue = "N/A"
        revenue_growth = "N/A"

        if len(income_data) >= 2:
            current_revenue = f"${income_data[0].get('revenue', 0)/1e9:.2f}B"
            previous_revenue = f"${income_data[1].get('revenue', 0)/1e9:.2f}B"
            if income_data[1].get('revenue', 0) > 0:
                growth = ((income_data[0].get('revenue', 0) - income_data[1].get('revenue', 0)) / income_data[1].get('revenue', 0)) * 100
                revenue_growth = f"{growth:.1f}%"

        live_data = {
            "name": profile_data.get('companyName', 'N/A'),
            "data": [
                {"metric": "Revenue", "current_year": current_revenue, "previous_year": previous_revenue, "yoy_growth": revenue_growth},
                {"metric": "Market Cap", "current_year": f"${profile_data.get('mktCap', 0)/1e9:.2f}B", "previous_year": "N/A", "yoy_growth": "N/A"},
                {"metric": "Stock Price", "current_year": f"${profile_data.get('price', 0):.2f}", "previous_year": "", "yoy_growth": f"{profile_data.get('changes', 0):.2f}%"}
            ],
            "prediction": f"<p>Live analysis for <strong>{profile_data.get('companyName', 'N/A')}</strong> based on real-time market data.</p>",
            "models": [profile_data.get('industry', 'N/A'), profile_data.get('sector', 'N/A')],
            "revenue_breakdown": [{"label": "Core Business", "value": 100}],
            "insights": {
                "financial": f"<ul><li>Market Cap: ${profile_data.get('mktCap', 0)/1e9:.2f}B</li><li>Stock Price: ${profile_data.get('price', 'N/A')}</li><li>Revenue Growth: {revenue_growth}</li></ul>",
                "market": f"<ul><li>Industry: {profile_data.get('industry', 'N/A')}</li><li>CEO: {profile_data.get('ceo', 'N/A')}</li><li>Exchange: {profile_data.get('exchange', 'N/A')}</li></ul>",
                "strategic": f"<ul><li>{profile_data.get('description', 'No description available.')}</li></ul>"
            }
        }

        print(f"Successfully fetched data for {symbol}")
        return jsonify({"status": "success", "data": live_data})

    except requests.exceptions.RequestException as e:
        print(f"API Request Error for {symbol}: {e}")
        return jsonify({"status": "error", "message": "Failed to fetch data from financial data provider."}), 502
    except Exception as e:
        print(f"Error processing company data for {symbol}: {e}")
        return jsonify({"status": "error", "message": f"An error occurred while processing company data."}), 500

# --- DeepSeek Code Generation API (ENHANCED) ---
@app.route('/api/deepseek', methods=['POST'])
def deepseek_proxy():
    user_query = request.json.get('prompt')
    api_key = os.environ.get('DEEPSEEK_API_KEY')
    if not api_key:
        return jsonify({'error': 'API key not set'}), 500
    try:
        response = requests.post(
            'https://api.deepseek.com/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'deepseek-chat',
                'messages': [{'role': 'user', 'content': user_query}]
            }
        )
        return jsonify(response.json())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- File Upload API ---
@app.route('/api/upload-file', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)
    save_path = os.path.join(uploads_dir, file.filename)
    file.save(save_path)
    uploaded_file = UploadedFile(filename=file.filename, saved_path=save_path)
    db.session.add(uploaded_file)
    db.session.commit()
    return jsonify({'success': True, 'file_id': uploaded_file.id, 'filename': file.filename})

# --- List Uploaded Files API ---
@app.route('/api/files', methods=['GET'])
def list_files():
    files = UploadedFile.query.order_by(UploadedFile.uploaded_at.desc()).all()
    return jsonify([
        {'id': f.id, 'filename': f.filename, 'uploaded_at': f.uploaded_at.isoformat()} for f in files
    ])

# --- Download File API ---
@app.route('/api/download-file/<int:file_id>', methods=['GET'])
def download_file(file_id):
    file = UploadedFile.query.get(file_id)
    if not file or not os.path.exists(file.saved_path):
        return jsonify({'error': 'File not found'}), 404
    return send_from_directory(os.path.dirname(file.saved_path), os.path.basename(file.saved_path), as_attachment=True)

# --- Authentication & User Management Endpoints ---
@app.route('/api/login', methods=['POST'])
def login():
    """
    Simple login endpoint for demo purposes
    """
    try:
        data = request.json
        username = data.get('username', '')
        password = data.get('password', '')
        
        # Simple demo authentication - in production, use proper auth
        if username and password:
            return jsonify({
                'status': 'success',
                'username': username,
                'message': 'Login successful'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Invalid credentials'
            }), 401
            
    except Exception as e:
        return jsonify({'error': f'Login failed: {str(e)}'}), 500

@app.route('/api/save_work', methods=['POST'])
def save_work():
    """
    Save user work state
    """
    try:
        data = request.json
        username = data.get('username', '')
        state = data.get('state', {})
        
        if not username:
            return jsonify({'error': 'Username required'}), 400
        
        # In a real app, save to database
        # For demo, just return success
        return jsonify({
            'status': 'success',
            'message': 'Work saved successfully'
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to save work: {str(e)}'}), 500

@app.route('/api/load_work/<username>', methods=['GET'])
def load_work(username):
    """
    Load user work state
    """
    try:
        if not username:
            return jsonify({'error': 'Username required'}), 400
        
        # In a real app, load from database
        # For demo, return default state
        default_state = {
            'user': {'name': username, 'email': f'{username}@example.com'},
            'workflow': {'uploads': 0, 'analyses': 0, 'lastFile': None, 'lastUploadDate': None},
            'history': [],
            'reports': [],
            'database': [],
            'lastAnalyzedCompany': None,
            'lastPrediction': {'summary': '', 'timestamp': None},
            'astraChat': {'sessions': [], 'activeSessionId': None},
            'currentView': 'dashboard',
            'isWorkspaceOpen': False
        }
        
        return jsonify({
            'status': 'success',
            'state': default_state
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to load work: {str(e)}'}), 500

# --- Data Storage & Management Endpoints ---
@app.route('/api/apply-sql-filter', methods=['POST'])
def apply_sql_filter():
    """
    Apply SQL-like filter to uploaded data
    """
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        filter_condition = data.get('filter_condition', '')
        file_data = data.get('file_data', [])
        filename = data.get('filename', '')
        
        if not filter_condition or not file_data:
            return jsonify({'error': 'Filter condition and file data required'}), 400
        
        # Parse the filter condition
        parsed_filter = parse_filter_condition(filter_condition)
        if not parsed_filter:
            return jsonify({'error': 'Invalid filter condition format'}), 400
        
        # Apply the filter
        filtered_data = apply_filter_to_data(file_data, parsed_filter)
        
        return jsonify({
            'status': 'success',
            'filtered_data': filtered_data,
            'original_count': len(file_data),
            'filtered_count': len(filtered_data),
            'filter_applied': filter_condition,
            'message': f'Filter applied successfully. {len(filtered_data)} rows returned from {len(file_data)} original rows.'
        })
        
    except Exception as e:
        print(f"Apply SQL filter error: {e}")
        return jsonify({'error': f'Failed to apply filter: {str(e)}'}), 500

def parse_filter_condition(condition):
    """
    Parse natural language filter condition into structured format
    Examples:
    - "Weekly_Sales > 2000" -> {'column': 'Weekly_Sales', 'operator': '>', 'value': 2000}
    - "Store_Type equals Electronics" -> {'column': 'Store_Type', 'operator': '=', 'value': 'Electronics'}
    """
    try:
        print(f"DEBUG: Parsing filter condition: '{condition}'")
        
        # Convert to lowercase for easier parsing
        condition_lower = condition.lower().strip()
        
        # Handle different comparison operators
        operators = {
            'greater than': '>',
            'less than': '<',
            'equals': '=',
            'not equals': '!=',
            'greater than or equal to': '>=',
            'less than or equal to': '<=',
            'contains': 'contains',
            'starts with': 'starts_with',
            'ends with': 'ends_with'
        }
        
        # Find the operator
        found_operator = None
        operator_symbol = None
        
        for op_text, op_symbol in operators.items():
            if op_text in condition_lower:
                found_operator = op_text
                operator_symbol = op_symbol
                break
        
        # If no text operator found, look for symbols
        if not found_operator:
            for symbol in ['>=', '<=', '!=', '>', '<', '=']:
                if symbol in condition:
                    operator_symbol = symbol
                    break
        
        print(f"DEBUG: Found operator: '{operator_symbol}'")
        
        if not operator_symbol:
            print("DEBUG: No operator found")
            return None
        
        # Split the condition
        if found_operator:
            parts = condition_lower.split(found_operator)
        else:
            # Split by operator symbol
            parts = condition.split(operator_symbol)
        
        print(f"DEBUG: Split parts: {parts}")
        
        if len(parts) != 2:
            print("DEBUG: Invalid number of parts after splitting")
            return None
        
        column_name = parts[0].strip()
        value = parts[1].strip()
        
        print(f"DEBUG: Column name: '{column_name}', Value: '{value}'")
        
        # Try to convert value to number if possible
        try:
            if '.' in value:
                value = float(value)
            else:
                value = int(value)
            print(f"DEBUG: Converted value to number: {value}")
        except ValueError:
            # Keep as string if conversion fails
            print(f"DEBUG: Keeping value as string: '{value}'")
            pass
        
        result = {
            'column': column_name,
            'operator': operator_symbol,
            'value': value
        }
        
        print(f"DEBUG: Final parsed result: {result}")
        return result
        
    except Exception as e:
        print(f"Error parsing filter condition: {e}")
        return None

def apply_filter_to_data(data, filter_info):
    """
    Apply filter to data based on parsed filter information
    """
    if not data or not filter_info:
        return data
    
    column = filter_info['column']
    operator = filter_info['operator']
    value = filter_info['value']
    
    print(f"DEBUG: Filter info - column: '{column}', operator: '{operator}', value: {value} (type: {type(value)})")
    print(f"DEBUG: First few rows of data:")
    for i, row in enumerate(data[:3]):
        print(f"  Row {i}: {row}")
        if column in row:
            print(f"    Column '{column}' value: {row[column]} (type: {type(row[column])})")
        else:
            print(f"    Column '{column}' NOT FOUND in row")
    
    filtered_data = []
    
    for row in data:
        if column not in row:
            continue
        
        cell_value = row[column]
        
        # Handle different data types
        try:
            # Try to convert cell value to number for numeric comparisons
            if isinstance(value, (int, float)) and cell_value is not None:
                try:
                    cell_numeric = float(cell_value) if '.' in str(cell_value) else int(cell_value)
                except (ValueError, TypeError):
                    cell_numeric = None
                
                if cell_numeric is not None:
                    # Numeric comparison
                    if operator == '>' and cell_numeric > value:
                        filtered_data.append(row)
                    elif operator == '<' and cell_numeric < value:
                        filtered_data.append(row)
                    elif operator == '>=' and cell_numeric >= value:
                        filtered_data.append(row)
                    elif operator == '<=' and cell_numeric <= value:
                        filtered_data.append(row)
                    elif operator == '=' and cell_numeric == value:
                        filtered_data.append(row)
                    elif operator == '!=' and cell_numeric != value:
                        filtered_data.append(row)
                    continue
            
            # String comparison
            cell_str = str(cell_value).lower() if cell_value is not None else ''
            value_str = str(value).lower()
            
            if operator == '=' and cell_str == value_str:
                filtered_data.append(row)
            elif operator == '!=' and cell_str != value_str:
                filtered_data.append(row)
            elif operator == 'contains' and value_str in cell_str:
                filtered_data.append(row)
            elif operator == 'starts_with' and cell_str.startswith(value_str):
                filtered_data.append(row)
            elif operator == 'ends_with' and cell_str.endswith(value_str):
                filtered_data.append(row)
                
        except Exception as e:
            print(f"Error applying filter to row: {e}")
            continue
    
    print(f"DEBUG: Filtered {len(filtered_data)} rows out of {len(data)} total rows")
    return filtered_data

@app.route('/api/save_filtered', methods=['POST'])
def save_filtered_data():
    """
    Save filtered data to the saved_files directory
    """
    try:
        data = request.json
        if not data or 'data' not in data:
            return jsonify({'error': 'No data provided'}), 400
        
        filtered_data = data['data']
        filename = data.get('filename', f"filtered_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        
        # Ensure filename is secure and has .csv extension
        filename = secure_filename(filename)
        if not filename.endswith('.csv'):
            filename += '.csv'
        
        filepath = os.path.join(SAVED_FILES_FOLDER, filename)
        
        # Convert data to CSV format
        if isinstance(filtered_data, list) and len(filtered_data) > 0:
            # If it's a list of dictionaries (JSON format)
            if isinstance(filtered_data[0], dict):
                headers = list(filtered_data[0].keys())
                with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
                    writer = csv.DictWriter(csvfile, fieldnames=headers)
                    writer.writeheader()
                    writer.writerows(filtered_data)
            else:
                # If it's a list of lists (array format)
                with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
                    writer = csv.writer(csvfile)
                    writer.writerows(filtered_data)
        else:
            return jsonify({'error': 'Invalid data format'}), 400
        
        # Get file stats
        file_stats = os.stat(filepath)
        
        # Count rows and columns
        with open(filepath, 'r', encoding='utf-8') as file:
            csv_reader = csv.reader(file)
            rows = list(csv_reader)
            row_count = len(rows) - 1 if rows else 0  # Subtract header
            col_count = len(rows[0]) if rows else 0
        
        return jsonify({
            'status': 'success',
            'message': 'Data saved successfully',
            'filename': filename,
            'filepath': filepath,
            'size': file_stats.st_size,
            'rows': row_count,
            'columns': col_count,
            'created_at': datetime.fromtimestamp(file_stats.st_ctime).isoformat()
        })
        
    except Exception as e:
        print(f"Save filtered data error: {e}")
        return jsonify({'error': f'Failed to save data: {str(e)}'}), 500

@app.route('/api/list_saved_files', methods=['GET'])
def list_saved_files():
    """
    List all saved files with their metadata
    """
    try:
        files_info = []
        
        if not os.path.exists(SAVED_FILES_FOLDER):
            return jsonify({'files': []})
        
        for filename in os.listdir(SAVED_FILES_FOLDER):
            filepath = os.path.join(SAVED_FILES_FOLDER, filename)
            
            if os.path.isfile(filepath):
                file_stats = os.stat(filepath)
                file_ext = filename.split('.')[-1].lower()
                
                # Determine file type
                if file_ext == 'csv':
                    file_type = 'CSV'
                elif file_ext in ['xlsx', 'xls']:
                    file_type = 'Excel'
                elif file_ext == 'json':
                    file_type = 'JSON'
                else:
                    file_type = file_ext.upper()
                
                # Get row and column count for CSV files
                rows, cols = 0, 0
                try:
                    if file_ext == 'csv':
                        with open(filepath, 'r', encoding='utf-8') as file:
                            csv_reader = csv.reader(file)
                            data_rows = list(csv_reader)
                            rows = len(data_rows) - 1 if data_rows else 0  # Subtract header
                            cols = len(data_rows[0]) if data_rows else 0
                    elif file_ext == 'json':
                        with open(filepath, 'r', encoding='utf-8') as file:
                            json_data = json.load(file)
                            if isinstance(json_data, list):
                                rows = len(json_data)
                                cols = len(json_data[0].keys()) if json_data and isinstance(json_data[0], dict) else 0
                except Exception as e:
                    print(f"Error reading file {filename}: {e}")
                
                files_info.append({
                    'filename': filename,
                    'type': file_type,
                    'rows': rows,
                    'columns': cols,
                    'size': file_stats.st_size,
                    'date_added': datetime.fromtimestamp(file_stats.st_ctime).strftime('%b %d, %Y'),
                    'created_at': datetime.fromtimestamp(file_stats.st_ctime).isoformat()
                })
        
        # Sort by creation date (newest first)
        files_info.sort(key=lambda x: x['created_at'], reverse=True)
        
        return jsonify({'files': files_info})
        
    except Exception as e:
        print(f"List saved files error: {e}")
        return jsonify({'error': f'Failed to list files: {str(e)}'}), 500

@app.route('/api/download_file/<filename>', methods=['GET'])
def download_saved_file(filename):
    """
    Download a saved file
    """
    try:
        # Secure the filename
        safe_filename = secure_filename(filename)
        filepath = os.path.join(SAVED_FILES_FOLDER, safe_filename)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        return send_from_directory(SAVED_FILES_FOLDER, safe_filename, as_attachment=True)
        
    except Exception as e:
        print(f"Download file error: {e}")
        return jsonify({'error': f'Failed to download file: {str(e)}'}), 500

# --- Frontend Serving ---
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/models/<path:filename>')
def serve_model(filename):
    model_dir = os.path.join(app.static_folder, 'public', 'models')
    return send_from_directory(model_dir, filename)

@app.errorhandler(404)
def not_found(e):
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
