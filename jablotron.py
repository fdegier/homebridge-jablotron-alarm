import os
import requests
import sys
import json

class Jablotron(object):
    def __init__(self, configuration):
        self.configuration = configuration
        self.api_url = 'https://api.jablonet.net/api/1.6'
        self.headers = {
            'x-vendor-id': 'MyJABLOTRON'
        }
        self._is_armed = None

    def _execute_request(self, endpoint, payload, session_id):
        cookies = {
            'PHPSESSID': session_id
        }

        r = requests.post(self.api_url + endpoint, cookies=cookies, headers=self.headers, data=payload).json()

        if str(r['status']) != "True":
            raise Exception(str(r['error_status']))

        return r

    def fetch_session_id(self):
        data = [
            ('login', self.configuration.user),
            ('password', self.configuration.password)
        ]
        
        return self._execute_request('/login.json', data, None)['session_id']

    def _control_section(self, state):
        data = [
            ('service', 'ja100'),
            ('serviceId', self.configuration.service_id),
            ('segmentId', 'STATE_1'),
            ('segmentKey', self.configuration.segment),
            ('expected_status', state),
            ('control_code', self.configuration.code),
        ]

        r = self._execute_request('/controlSegment.json', data, self.fetch_session_id())

        result = len(r['segment_updates']) != 0
        
        if result:
            if state == 'set':
                self._is_armed = True
            if state == 'unset':
                self._is_armed = False

        return result

    def is_armed(self):
        payload = [
            ('data',
             '[{"filter_data":[{"data_type":"section"}],"service_type":"ja100","service_id":' + self.configuration.service_id + ',"data_group":"serviceData","connect":true}]')
        ]

        r = self._execute_request('/dataUpdate.json', payload, self.fetch_session_id())

        segments = r['data']['service_data'][0]['data'][0]['data']['segments']
        segment_status = {}

        for segment in segments:
            segment_status[segment['segment_key']] = segment['segment_state']

        self._is_armed = segment_status[self.configuration.segment] != "unset"

        return self._is_armed

    def activate_alarm(self):
        return self._control_section(state="set")

    def deactivate_alarm(self):
        return self._control_section(state="unset")

class JablotronCached(Jablotron):
    def __init__(self, configuration, allow_caching_of_state):
        Jablotron.__init__(self, configuration)
        self.allow_caching_of_state = allow_caching_of_state
        self.cache_filepath = os.path.dirname(os.path.realpath(__file__)) + '/cache.json'
        
        self._cache_data = self._load_cache()
        
        if not os.path.exists(self.cache_filepath):
            self._save_cache(self._cache_data)

    def fetch_session_id(self):
        return self._cache_data['session_id']

    def is_armed(self):
        if not self.allow_caching_of_state or self._cache_data['is_armed'] is None:
            self._cache_data['is_armed'] = super(JablotronCached, self).is_armed()
            self._save_cache(self._cache_data)

        return self._cache_data['is_armed']

    def _control_section(self, state):
        result = super(JablotronCached, self)._control_section(state)
        self._cache_data['is_armed'] = self._is_armed
        self._save_cache(self._cache_data)
        return result

    def _execute_request(self, endpoint, payload, session_id):
        try:
            return super(JablotronCached, self)._execute_request(endpoint, payload, session_id)
        except Exception as ex:
            if ex.message == "not_logged_in":
                self._invalidate_cache()
                self._load_cache()
                self._save_cache(self._cache_data)

                return self._execute_request(endpoint, payload, session_id)
            
            raise

    def _invalidate_cache(self):
        os.remove(self.cache_filepath)

    def _save_cache(self, cache_data):
        with open(self.cache_filepath, 'w') as outfile:
            json.dump(cache_data, outfile)

    def _load_cache(self):
        if os.path.exists(self.cache_filepath):
            with open(self.cache_filepath) as f:
                return json.load(f)

        return {
            'session_id': super(JablotronCached, self).fetch_session_id(),
            'is_armed': None
        }        

class JablotronConfiguration:
    def __init__(self, user, password, code, service_id, segment):
        self.user = user
        self.password = password
        self.code = code
        self.service_id = service_id
        self.segment = segment

class CliProcessor:
    def __init__(self, argv):
        self.argv = argv
        self.command = argv[1]

    def get_command(self):
        return self.command

    def create_configuration(self):
        return JablotronConfiguration(self.argv[2], self.argv[3], self.argv[4], self.argv[5], self.argv[6])

    def print_armed_status(self, is_armed):
        status = "DISARMED"
        if is_armed:
            status = "ARMED"

        print(status)
        sys.stdout.flush()

cliProcessor = CliProcessor(sys.argv)
jablotron = JablotronCached(cliProcessor.create_configuration(), True)

command = cliProcessor.get_command()

action_map = {
    "getState": jablotron.is_armed,
    "3": jablotron.deactivate_alarm, # DISARM
    "0": jablotron.activate_alarm, # stay_arm
    "1": jablotron.activate_alarm, # away_arm
    "2": jablotron.activate_alarm # night_arm
}

result = action_map[command]()

if command == "3":
    result = not result

cliProcessor.print_armed_status(result)