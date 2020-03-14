# app.py
from flask import Flask, request, send_file
from service.report import get_report, get_timeseries

app = Flask(__name__)

@app.route('/report')
def report():
    recipe_id = request.args.get('recipeId')
    excel_report = get_report(recipe_id)
    return send_file(excel_report,
                attachment_filename='your_filename.xlsx',
                as_attachment=True)

@app.route('/timeseries')
def timeseries():
    excel_report = get_timeseries(request.args.get('recipeId'),
        request.args.get('startTime'),
        request.args.get('endTime'))
    
    if isinstance(excel_report, str):
        return excel_report
    else:
        return send_file(excel_report,
            attachment_filename='your_filename.xlsx',
            as_attachment=True)

@app.route('/')
def default_route():
    return "hello world"

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')