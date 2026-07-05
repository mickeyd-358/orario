from datetime import date, timedelta

from flask import Blueprint, jsonify, render_template, request
from flask_login import current_user, login_required

from extensions import db
from models import DailyStudyLog, User

pomodoro_bp = Blueprint("pomodoro", __name__)

@pomodoro_bp.route("/timer_dashboard", methods=['GET'])
@login_required
def timer_dashboard():
    return render_template('pomodoro.html')


@pomodoro_bp.route('/api/save_study_time', methods=['POST'])
@login_required
def save_study_time():
    data = request.get_json() or {}
    minutes = data.get('minutes')

    if not minutes:
        return jsonify({"success": False, "error": "No time provided"}), 400

    today = date.today()

    try:
        # Check if an entry already exists for this user today
        log = DailyStudyLog.query.filter_by(user_id=current_user.id, date=today).first()

        if log:
            # If it exists, add the new minutes to their current total
            log.total_minutes += int(minutes)
        else:
            # If it's their first session of the day, create a new record
            log = DailyStudyLog(
                user_id=current_user.id,
                date=today,
                study_group=current_user.study_group,
                total_minutes=int(minutes)
            )
            db.session.add(log)

        db.session.commit()
        return jsonify({"success": True, "total_minutes": log.total_minutes}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    

@pomodoro_bp.route('/api/update_group', methods=["POST"])
@login_required
def update_group():
    data = request.get_json()
    
    if not data or 'group' not in data:
        return jsonify({'success': False, 'error': 'Invalid group details'}), 400

    current_user.study_group = data['group']
    db.session.commit()

    return jsonify({'success': True}), 200


@pomodoro_bp.route("/study_leaderboard", methods=['GET'])
@login_required
def study_leaderboard():
    group_name = request.args.get('group')
    
    if not group_name:
        return "Group name parameter is required.", 400

    today = date.today()

    leaderboard_data = db.session.query(
        User.name,
        DailyStudyLog.total_minutes,
        User.is_studying,
    ).join(DailyStudyLog, User.id == DailyStudyLog.user_id)\
     .filter(User.study_group == group_name)\
     .filter(DailyStudyLog.date == today)\
     .order_by(DailyStudyLog.total_minutes.desc())\
     .all()
    
    print(group_name)
    print(leaderboard_data)

    return render_template(
        'study_leaderboard.html', 
        group_name=group_name
    )


@pomodoro_bp.route("/api/leaderboard_data", methods=['GET'])
@login_required
def leaderboard_data():
    group_name = request.args.get('group')
    if not group_name:
        return jsonify({"success": False, "error": "Group name required"}), 400

    studying_users = db.session.query()

    today = date.today()

    # Query exactly like before
    raw_data = db.session.query(
        User.name,
        DailyStudyLog.total_minutes,
        User.is_studying,
    ).join(DailyStudyLog, User.id == DailyStudyLog.user_id)\
     .filter(User.study_group == group_name)\
     .filter(DailyStudyLog.date == today)\
     .order_by(DailyStudyLog.total_minutes.desc())\
     .all()

    # Convert the raw database tuples into a clean list of dictionaries
    formatted_leaderboard = [
        {"name": row[0], "total_minutes": row[1], "is_studying": row[2]} for row in raw_data
    ]

    return jsonify({
        "success": True,
        "group_name": group_name,
        "leaderboard": formatted_leaderboard
    }), 200

@pomodoro_bp.route('/api/toggle_activity', methods=['POST'])
@login_required
def toggle_activity():

    data = request.get_json() or {}
    status = data.get('is_studying')

    current_user.is_studying = status
    db.session.commit()
    
    return jsonify({'success': True}), 200

@pomodoro_bp.route('/api/calculate_streak', methods=['GET'])
@login_required
def calculate_streak():

    id = current_user.id

    raw_data = db.session.query(DailyStudyLog.date).filter(DailyStudyLog.user_id == id).all()

    dates_list = [row.date for row in raw_data]
    dates_list.sort(reverse=True)

    today = date.today()

    # Logic for if a user has not studied at all yet
    if not dates_list:
        return jsonify({"success": True, "streak": 0})

    # If the user hasn't studied today or yesterday, their streak is 0
    if dates_list[0] != today and dates_list[0] != today - timedelta(days=1):
        return jsonify({"success": True, "streak": 0})

    streak = 1

    for i in range(len(dates_list) - 1):
        # Check if the older date is exactly 1 day before the newer date
        if (dates_list[i] - dates_list[i + 1]).days == 1:
            streak += 1
        elif (dates_list[i] - dates_list[i + 1]).days == 0:
            continue
        else:
            # The moment there is a gap greater than 1 day, the current streak ends
            break


    return jsonify({"success": True, "streak": streak})