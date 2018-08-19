import requests
import sys

class Jablotron:
    def __init__(self):
        self.user = sys.argv[2]
        self.password = sys.argv[3]
        self.code = sys.argv[4]
        self.service_id = sys.argv[5]
        self.segment = sys.argv[6]
        self.update_cookie(cookie=None)

        self.headers = {
            'x-vendor-id': 'MyJABLOTRON'
        }

    def update_cookie(self, cookie):
        if cookie is None:
            self.PHPSESSID = open("/home/pi/.npm-global/lib/node_modules/homebridge-jablotron/cookie.txt", 'r').readline()
        else:
            open("/home/pi/.npm-global/lib/node_modules/homebridge-jablotron/cookie.txt", 'w').writelines(str(cookie))
            self.PHPSESSID = cookie
        self.cookies = {
            'PHPSESSID': cookie
        }
        return True

    def login(self):
        data = [
            ('login', self.user),
            ('password', self.password)
        ]

        r = requests.post('https://api.jablonet.net/api/1.6/login.json', headers=self.headers, data=data).json()
        if str(r['status']) == "True":
            self.update_cookie(r['session_id'])
            return True
        else:
            return False

    def get_status(self):
        payload = [
            ('data',
             '[{"filter_data":[{"data_type":"section"}],"service_type":"ja100","service_id":' + self.service_id + ',"data_group":"serviceData","connect":true}]')
        ]

        r = requests.post('https://api.jablonet.net/api/1.6/dataUpdate.json', cookies=self.cookies, headers=self.headers,
                          data=payload).json()
        status = r['status']

        if str(status) == "True":
            segments = r['data']['service_data'][0]['data'][0]['data']['segments']
            segment_status = {}

            for segment in segments:
                segment_status[segment['segment_key']] = segment['segment_state']

            if segment_status[self.segment] == "unset":
                sys.stdout.write(str("DISARMED"))
                sys.stdout.flush()
            else:
                sys.stdout.write(str("AWAY_ARM"))
                sys.stdout.flush()

            return True

        else:
            error_code = r['error_status']
            if str(error_code) == "not_logged_in":
                self.login()
                self.get_status()

    def control_section(self, section, state):
        data = [
            ('service', 'ja100'),
            ('serviceId', self.service_id),
            ('segmentId', 'STATE_1'),
            ('segmentKey', self.segment),
            ('expected_status', state),
            ('control_code', self.code),
        ]

        r = requests.post('https://api.jablonet.net/api/1.6/controlSegment.json', headers=self.headers, cookies=self.cookies,
                          data=data).json()
        status = r['status']
        if str(status) == "True":
            if len(r['segment_updates']) == 0:
                return False
        else:
            error_code = r['error_status']
            if str(error_code) == "not_logged_in":
                self.login()
                self.control_section(section=section, state=state)

        return True

    # These functions are for testing homebridge-script2
    def activate_alarm(self):
        if self.control_section(section=None, state="set") is True:
            return "ARMED" # away_arm
        else:
            return "DISARMED" # disarm

    def deactivate_alarm(self):
        if self.control_section(section=None, state="unset") is True:
            print("DISARMED") # disarm
        else:
            print("ARMED") # away_arm

state = sys.argv[1]

actions = {"getState": "get_status",
           "STAY_ARM (0)": None,
           "NIGHT_ARM (2)": None,
           "AWAY_ARM (1)": "activate_alarm",
           "DISARM (3)": "deactivate_alarm"}

jablotron = Jablotron()

if state == "getState":
    jablotron.get_status()
elif state == "1": # away_arm
    jablotron.activate_alarm()
elif state == "3": # DISARM
    jablotron.deactivate_alarm()
elif state == "0": # stay_arm
    jablotron.activate_alarm()
elif state == "2": # night_arm
    jablotron.activate_alarm()
