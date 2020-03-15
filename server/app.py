# app.py
from flask import Flask, request, send_file
from service.report import get_report, get_timeseries
<<<<<<< HEAD
=======
from gpiozero import MCP3008
import time
import Adafruit_GPIO.SPI as SPI
import Adafruit_MCP3008

CLK  = 18
MISO = 23
MOSI = 24
CS   = 25
mcp = Adafruit_MCP3008.MCP3008(clk=CLK, cs=CS, miso=MISO, mosi=MOSI)
while True:
    # Read all the ADC channel values in a list.
    values = [0]*8
    for i in range(8):
        # The read_adc function will get the value of the specified channel (0-7).
        values[i] = mcp.read_adc(i)
    # Print the ADC values.
    print('| {0:>4} | {1:>4} | {2:>4} | {3:>4} | {4:>4} | {5:>4} | {6:>4} | {7:>4} |'.format(*values))
    # Pause for half a second.
    time.sleep(0.5)
>>>>>>> test

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