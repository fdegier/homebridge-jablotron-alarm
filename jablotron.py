import os
import requests
import sys

class Jablotron:
    def __init__(self):
        self.user = sys.argv[2]
        self.password = sys.argv[3]
        self.code = sys.argv[4]
        self.service_id = sys.argv[5]
        self.segment = sys.argv[6]
        self._update_cookie(cookie=None)

        self.api_url = 'https://api.jablonet.net/api/1.6'

        self.headers = {
            'x-vendor-id': 'MyJABLOTRON'
        }

    def login(self):
        data = [
            ('login', self.user),
            ('password', self.password)
        ]

        r = requests.post(self.api_url + '/login.json', headers=self.headers, data=data).json()
        if str(r['status']) == "True":
            self._update_cookie(r['session_id'])
            return True
        else:
            return False

    def get_status(self):
        payload = [
            ('data',
             '[{"filter_data":[{"data_type":"section"}],"service_type":"ja100","service_id":' + self.service_id + ',"data_group":"serviceData","connect":true}]')
        ]

        r = requests.post(self.api_url + '/dataUpdate.json', cookies=self.cookies, headers=self.headers, data=payload).json()
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

    def _update_cookie(self, cookie):
        path = os.path.dirname(os.path.realpath(__file__))
        if cookie is None:
            self.PHPSESSID = open(path + "/cookie.txt", 'r').readline()
        else:
            open(path + "/cookie.txt", 'w').writelines(str(cookie))
            self.PHPSESSID = cookie
        self.cookies = {
            'PHPSESSID': cookie
        }
        return True

    def _control_section(self, section, state):
        data = [
            ('service', 'ja100'),
            ('serviceId', self.service_id),
            ('segmentId', 'STATE_1'),
            ('segmentKey', self.segment),
            ('expected_status', state),
            ('control_code', self.code),
        ]

        r = requests.post(self.api_url + '/controlSegment.json', headers=self.headers, cookies=self.cookies, data=data).json()
        status = r['status']
        if str(status) == "True":
            if len(r['segment_updates']) == 0:
                return False
        else:
            error_code = r['error_status']
            if str(error_code) == "not_logged_in":
                self.login()
                self._control_section(section=section, state=state)

        return True

    # These functions are for testing homebridge-script2
    def activate_alarm(self):
        if self._control_section(section=None, state="set") is True:
            return "ARMED" # away_arm
        else:
            return "DISARMED" # disarm

    def deactivate_alarm(self):
        if self._control_section(section=None, state="unset") is True:
            print("DISARMED") # disarm
        else:
            print("ARMED") # away_arm

state = sys.argv[1]

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
