import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar
} from 'react-native';

export default function App() {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [aircraftType, setAircraftType] = useState('B747_A340');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('calc');

  const startTimeInputRef = useRef(null);
  const endTimeInputRef = useRef(null);

  // Strikte Validierung mit Zurücksetzung auf 00:00 bei Überschreitung
  const processAndValidateTimeInput = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length === 0) return { formatted: '', isError: false };

    let hours = cleaned.substring(0, 2);
    let minutes = cleaned.substring(2, 4);

    // Prüfung der Stunden (> 23 -> Fehler -> Nullstellung)
    if (hours.length === 2) {
      const hNum = parseInt(hours, 10);
      if (hNum > 23) {
        return { formatted: '00:00', isError: true };
      }
    }

    // Prüfung der Minuten (> 59 -> Fehler -> Nullstellung)
    if (minutes.length === 2) {
      const mNum = parseInt(minutes, 10);
      if (mNum > 59) {
        return { formatted: '00:00', isError: true };
      }
    }

    let formatted = hours;
    if (cleaned.length > 2) {
      formatted = `${hours}:${minutes}`;
    }

    return { formatted, isError: false };
  };

  const parseTimeToMinutes = (hhmmStr) => {
    if (!hhmmStr || hhmmStr.length < 5) return null;
    const parts = hhmmStr.split(':');
    if (parts.length !== 2) return null;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  const formatMinutesToIndustrialTime = (totalMinutes) => {
    const hoursDecimal = totalMinutes / 60;
    return hoursDecimal.toFixed(2).replace('.', ',');
  };

  const calculateOvertimeWithParams = (startStr, endStr, type) => {
    const startMin = parseTimeToMinutes(startStr);
    const endMin = parseTimeToMinutes(endStr);

    if (startMin === null || endMin === null) {
      setResult(null);
      return;
    }

    let diffMinutes = endMin - startMin;
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }

    let intervalCount = 0;

    if (diffMinutes > 30) {
      const thresholdTime = startMin + 30;
      let firstIntervalMin = thresholdTime + 1; 

      for (let t = firstIntervalMin; t <= startMin + diffMinutes; t += 15) {
        intervalCount++;
      }
    }

    const multiplier = type === 'B747_A340' ? 6 : 4;
    const calculatedFactorMinutes = intervalCount * 15 * multiplier;

    setResult({
      diffMinutes,
      aircraftType: type,
      multiplier,
      formattedResultTime: formatMinutesToIndustrialTime(calculatedFactorMinutes),
      intervalCount
    });
  };

  const handleAircraftChange = (type) => {
    setAircraftType(type);
    if (startTime.length === 5 && endTime.length === 5) {
      calculateOvertimeWithParams(startTime, endTime, type);
    }
  };

  const handleStartTimeChange = (text) => {
    let inputToProcess = text;
    if (startTime === '00:00' && text.length > 5) {
      inputToProcess = text.slice(-1);
    }

    const { formatted, isError } = processAndValidateTimeInput(inputToProcess);

    if (isError) {
      setStartTime('00:00');
      setErrorMsg('Ungültige Zeit für STD! Auf 00:00 zurückgesetzt.');
      setResult(null);
      setTimeout(() => {
        startTimeInputRef.current?.setSelection(0, 5);
      }, 10);
      return;
    }

    setErrorMsg('');
    setStartTime(formatted);

    const rawCleaned = inputToProcess.replace(/[^0-9]/g, '');
    if (rawCleaned.length === 4) {
      setTimeout(() => {
        endTimeInputRef.current?.focus();
        endTimeInputRef.current?.setSelection(0, 5);
      }, 50);
    }

    if (formatted.length === 5 && endTime.length === 5) {
      calculateOvertimeWithParams(formatted, endTime, aircraftType);
    } else {
      setResult(null);
    }
  };

  const handleEndTimeChange = (text) => {
    let inputToProcess = text;
    if (endTime === '00:00' && text.length > 5) {
      inputToProcess = text.slice(-1);
    }

    const { formatted, isError } = processAndValidateTimeInput(inputToProcess);

    if (isError) {
      setEndTime('00:00');
      setErrorMsg('Ungültige Zeit für OFB! Auf 00:00 zurückgesetzt.');
      setResult(null);
      setTimeout(() => {
        endTimeInputRef.current?.setSelection(0, 5);
      }, 10);
      return;
    }

    setErrorMsg('');
    setEndTime(formatted);

    if (startTime.length === 5 && formatted.length === 5) {
      calculateOvertimeWithParams(startTime, formatted, aircraftType);
    } else {
      setResult(null);
    }
  };

  const calculateOvertime = () => {
    calculateOvertimeWithParams(startTime, endTime, aircraftType);
  };

  const clearInputs = () => {
    setStartTime('');
    setEndTime('');
    setResult(null);
    setErrorMsg('');
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <View style={styles.mainContainer}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.themeToggle, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
            onPress={() => setIsDarkMode(!isDarkMode)}
          >
            <Text style={[styles.themeToggleText, { color: theme.primary }]}>
              {isDarkMode ? '☀️ LIGHT MODE' : '🌙 DARK MODE'}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: theme.titleColor }]}>Überstunden Rechner</Text>
          <View style={[styles.accentLine, { backgroundColor: theme.primary }]} />
        </View>

        {/* TAB NAVIGATION */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
              activeTab === 'calc' && { backgroundColor: theme.primary, borderColor: theme.primary }
            ]}
            onPress={() => setActiveTab('calc')}
          >
            <Text
              style={[
                styles.tabButtonText,
                { color: theme.textColor },
                activeTab === 'calc' && { color: isDarkMode ? '#090d16' : '#ffffff', fontWeight: '900' }
              ]}
            >
              RECHNER
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
              activeTab === 'guide' && { backgroundColor: theme.primary, borderColor: theme.primary }
            ]}
            onPress={() => setActiveTab('guide')}
          >
            <Text
              style={[
                styles.tabButtonText,
                { color: theme.textColor },
                activeTab === 'guide' && { color: isDarkMode ? '#090d16' : '#ffffff', fontWeight: '900' }
              ]}
            >
              ANLEITUNG
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: RECHNER */}
        {activeTab === 'calc' ? (
          <View style={styles.calcViewWrapper}>
            
            {/* EINGABE ZEITEN (Jetzt ganz oben) */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.cardLabel, { color: theme.primary }]}>ZEITFENSTER EINGEBEN (HH:MM)</Text>
              
              {errorMsg ? <Text style={[styles.errorText, { color: theme.errorColor }]}>{errorMsg}</Text> : null}

              <View style={styles.inputRow}>
                
                <View style={styles.inputWrapper}>
                  <Text style={[styles.inputSubLabel, { color: theme.subTextColor }]}>STD</Text>
                  <TextInput
                    ref={startTimeInputRef}
                    style={[styles.timeInput, { backgroundColor: theme.inputBg, borderColor: theme.borderColor, color: theme.textColor }]}
                    value={startTime}
                    onChangeText={handleStartTimeChange}
                    onFocus={() => {
                      if (startTime === '00:00') {
                        startTimeInputRef.current?.setSelection(0, 5);
                      }
                    }}
                    placeholder="08:00"
                    placeholderTextColor={theme.placeholderColor}
                    keyboardType="numeric"
                    maxLength={5}
                    returnKeyType="next"
                    onSubmitEditing={() => {
                      endTimeInputRef.current?.focus();
                      endTimeInputRef.current?.setSelection(0, 5);
                    }}
                    blurOnSubmit={false}
                  />
                </View>

                <View style={styles.inputSeparator}>
                  <Text style={[styles.separatorText, { color: theme.primary }]}>→</Text>
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={[styles.inputSubLabel, { color: theme.subTextColor }]}>OFB</Text>
                  <TextInput
                    ref={endTimeInputRef}
                    style={[styles.timeInput, { backgroundColor: theme.inputBg, borderColor: theme.borderColor, color: theme.textColor }]}
                    value={endTime}
                    onChangeText={handleEndTimeChange}
                    onFocus={() => {
                      if (endTime === '00:00') {
                        endTimeInputRef.current?.setSelection(0, 5);
                      }
                    }}
                    placeholder="16:45"
                    placeholderTextColor={theme.placeholderColor}
                    keyboardType="numeric"
                    maxLength={5}
                    returnKeyType="done"
                    onSubmitEditing={calculateOvertime}
                  />
                </View>

              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primary }]} onPress={calculateOvertime}>
                  <Text style={[styles.actionButtonText, { color: isDarkMode ? '#090d16' : '#ffffff' }]}>BERECHNEN</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.inputBg, borderColor: theme.borderColor, borderWidth: 1 }]} onPress={clearInputs}>
                  <Text style={[styles.actionButtonText, { color: theme.subTextColor }]}>RESET</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* FLUGZEUGTYP SELEKTOR (Jetzt darunter) */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.cardLabel, { color: theme.primary }]}>FLUGZEUGTYP WÄHLEN</Text>
              <View style={styles.typeContainer}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    { backgroundColor: theme.inputBg, borderColor: theme.borderColor },
                    aircraftType === 'B747_A340' && { backgroundColor: theme.activeBtnBg, borderColor: theme.primary }
                  ]}
                  onPress={() => handleAircraftChange('B747_A340')}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      { color: theme.textColor },
                      aircraftType === 'B747_A340' && { color: theme.primary, fontWeight: '800' }
                    ]}
                  >
                    B747 & A340/600
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    { backgroundColor: theme.inputBg, borderColor: theme.borderColor },
                    aircraftType === 'ALL_OTHERS' && { backgroundColor: theme.activeBtnBg, borderColor: theme.primary }
                  ]}
                  onPress={() => handleAircraftChange('ALL_OTHERS')}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      { color: theme.textColor },
                      aircraftType === 'ALL_OTHERS' && { color: theme.primary, fontWeight: '800' }
                    ]}
                  >
                    Alle anderen
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ERGEBNIS ANZEIGE */}
            <View style={[styles.card, styles.resultCard, { backgroundColor: theme.resultBg, borderColor: result ? theme.successColor : theme.borderColor }]}>
              <Text style={[styles.resultTitle, { color: result ? theme.successColor : theme.subTextColor }]}>
                BERECHNUNGSERGEBNIS
              </Text>
              
              <View style={styles.singleResultBox}>
                <View style={[styles.resultBoxFull, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Text style={[styles.resultBoxValue, { color: theme.textColor }]}>
                    {result ? `${result.diffMinutes} Min.` : '-- Min.'}
                  </Text>
                  <Text style={[styles.resultBoxLabel, { color: theme.subTextColor }]}>Gesamtdifferenz</Text>
                </View>
              </View>

              <View style={[styles.resultHighlight, { backgroundColor: theme.highlightBg, borderColor: result ? theme.successColor : theme.borderColor }]}>
                <Text style={[styles.resultHighlightLabel, { color: result ? theme.successColor : theme.subTextColor }]}>
                  BERECHNETE ÜBERSTUNDEN (INDUSTRIEZEIT)
                </Text>
                <Text style={[styles.resultHighlightValue, { color: result ? theme.successColor : theme.subTextColor }]}>
                  {result ? result.formattedResultTime : '0,00'}
                </Text>
                <Text style={[styles.resultHighlightSub, { color: theme.subTextColor }]}>
                  {result ? `${result.intervalCount} Intervall(e) × 15 Min. × ${result.multiplier}` : 'Keine Eingabe erfolgt'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* TAB 2: ANLEITUNG & ENTWICKLERINFO */
          <ScrollView contentContainerStyle={styles.guideScrollContainer} keyboardShouldPersistTaps="handled">
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.cardLabel, { color: theme.primary }]}>APP ANLEITUNG & BEDIENUNG</Text>
              
              <View style={styles.guideStep}>
                <Text style={[styles.guideStepTitle, { color: theme.textColor }]}>1. STD und OFB eingeben</Text>
                <Text style={[styles.guideStepDesc, { color: theme.subTextColor }]}>
                  Gib zuerst die Zeiten für STD und OFB im Format HH:MM ein. Bei Fehleingaben (z.B. Stunden > 23 oder Minuten > 59) wird das jeweilige Feld auf 00:00 zurückgesetzt und der Cursor springt an den Anfang, sodass du sofort weitertippen kannst.
                </Text>
              </View>

              <View style={styles.guideStep}>
                <Text style={[styles.guideStepTitle, { color: theme.textColor }]}>2. Flugzeugtyp auswählen</Text>
                <Text style={[styles.guideStepDesc, { color: theme.subTextColor }]}>
                  Wähle aus, ob es sich um eine B747 oder A340/600 (Faktor 6) oder um "Alle anderen" (Faktor 4) handelt. Die Berechnung passt sich sofort an.
                </Text>
              </View>

              <View style={styles.guideStep}>
                <Text style={[styles.guideStepTitle, { color: theme.textColor }]}>3. Berechnen</Text>
                <Text style={[styles.guideStepDesc, { color: theme.subTextColor }]}>
                  Mit Betätigen von "OK" / "Enter" auf der Tastatur oder dem "BERECHNEN"-Button wird das Ergebnis in Industriezeit (z. B. 1,75) ermittelt.
                </Text>
              </View>

              <View style={styles.guideStep}>
                <Text style={[styles.guideStepTitle, { color: theme.textColor }]}>4. Berechnungslogik</Text>
                <Text style={[styles.guideStepDesc, { color: theme.subTextColor }]}>
                  Ab einer Zeitdifferenz von mehr als 30 Minuten wird ab dem nächsten 15-Minuten-Raster (z. B. bei STD 10:00 ab Minute 46: 10:46, 11:01, 11:16, 11:31 usw.) gerechnet und mit dem jeweiligen Typen-Faktor multipliziert.
                </Text>
              </View>
            </View>

            {/* ENTWICKLERINFO */}
            <View style={[styles.card, styles.devCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.devTitle, { color: theme.primary }]}>ENTWICKLERINFORMATIONEN</Text>
              <View style={styles.devRow}>
                <Text style={[styles.devLabel, { color: theme.subTextColor }]}>Entwickler:</Text>
                <Text style={[styles.devValue, { color: theme.textColor }]}>Özgür Cetin</Text>
              </View>
              <View style={styles.devRow}>
                <Text style={[styles.devLabel, { color: theme.subTextColor }]}>E-Mail:</Text>
                <Text style={[styles.devValue, { color: theme.textColor }]}>ozgur.cetin@web.de</Text>
              </View>
            </View>
          </ScrollView>
        )}

      </View>
    </SafeAreaView>
  );
}

const lightTheme = {
  bg: '#f4f6f9',
  cardBg: '#ffffff',
  inputBg: '#f8fafc',
  activeBtnBg: '#e0f2fe',
  resultBg: '#f0fdf4',
  highlightBg: '#dcfce7',
  titleColor: '#0f172a',
  textColor: '#1e293b',
  subTextColor: '#64748b',
  placeholderColor: '#94a3b8',
  borderColor: '#e2e8f0',
  primary: '#0284c7',
  successColor: '#16a34a',
  errorColor: '#dc2626'
};

const darkTheme = {
  bg: '#090d16',
  cardBg: '#111827',
  inputBg: '#090d16',
  activeBtnBg: 'rgba(0, 242, 254, 0.12)',
  resultBg: '#0e1726',
  highlightBg: 'rgba(16, 185, 129, 0.1)',
  titleColor: '#f8fafc',
  textColor: '#f8fafc',
  subTextColor: '#64748b',
  placeholderColor: '#3a4b6e',
  borderColor: '#1e293b',
  primary: '#00f2fe',
  successColor: '#10b981',
  errorColor: '#ef4444'
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  themeToggle: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 4,
  },
  themeToggleText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  accentLine: {
    width: 80,
    height: 3,
    borderRadius: 2,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  calcViewWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  guideScrollContainer: {
    paddingBottom: 20,
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  inputWrapper: {
    flex: 1,
  },
  inputSubLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: 'center',
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 8,
    letterSpacing: 2,
  },
  inputSeparator: {
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  separatorText: {
    fontSize: 18,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.1,
  },
  resultCard: {
    borderWidth: 1.5,
    marginBottom: 0,
  },
  resultTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  singleResultBox: {
    marginBottom: 8,
  },
  resultBoxFull: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  resultBoxValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  resultBoxLabel: {
    fontSize: 9,
    marginTop: 2,
    fontWeight: '700',
  },
  resultHighlight: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  resultHighlightLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  resultHighlightValue: {
    fontSize: 28,
    fontWeight: '900',
    marginVertical: 2,
  },
  resultHighlightSub: {
    fontSize: 10,
  },
  guideStep: {
    marginBottom: 14,
  },
  guideStepTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  guideStepDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  devCard: {
    marginTop: 4,
  },
  devTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  devRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  devLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  devValue: {
    fontSize: 12,
    fontWeight: '700',
  },
});
