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
  
  // States für den neuen E-Mail Rechner Tab
  const [emailDateTime, setEmailDateTime] = useState('');
  const [orderDateTime, setOrderDateTime] = useState('');
  const [emailResult, setEmailResult] = useState(null);
  const [emailErrorMsg, setEmailErrorMsg] = useState('');

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('calc');

  const startTimeInputRef = useRef(null);
  const endTimeInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const orderInputRef = useRef(null);

  // Strikte Validierung für Uhrzeiten (HH:MM)
  const processAndValidateTimeInput = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length === 0) return { formatted: '', isError: false };

    let hours = cleaned.substring(0, 2);
    let minutes = cleaned.substring(2, 4);

    if (hours.length === 2) {
      const hNum = parseInt(hours, 10);
      if (hNum > 23) {
        return { formatted: '00:00', isError: true };
      }
    }

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

  // Hilfsschema für die Eingabe von Datum & Zeit (DD.MM. HH:MM)
  const processAndValidateDateTimeInput = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length === 0) return { formatted: '', isError: false };

    let day = cleaned.substring(0, 2);
    let month = cleaned.substring(2, 4);
    let hours = cleaned.substring(4, 6);
    let minutes = cleaned.substring(6, 8);

    if (day.length === 2 && parseInt(day, 10) > 31) day = '31';
    if (month.length === 2 && parseInt(month, 10) > 12) month = '12';
    if (hours.length === 2 && parseInt(hours, 10) > 23) hours = '23';
    if (minutes.length === 2 && parseInt(minutes, 10) > 59) minutes = '59';

    let formatted = day;
    if (cleaned.length > 2) formatted = `${day}.${month}`;
    if (cleaned.length > 4) formatted = `${day}.${month} ${hours}`;
    if (cleaned.length > 6) formatted = `${day}.${month} ${hours}:${minutes}`;

    return { formatted, isError: false };
  };

  // Parsen von DD.MM. HH:MM zu Minuten im Jahr (vereinfacht für Differenz)
  const parseDateTimeToMinutes = (str) => {
    if (!str || str.length < 11) return null;
    const parts = str.split(/[\. :]/);
    if (parts.length < 4) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const hours = parseInt(parts[2], 10);
    const minutes = parseInt(parts[3], 10);

    if (isNaN(day) || isNaN(month) || isNaN(hours) || isNaN(minutes)) return null;
    // Approximierte Minutenberechnung über Tage und Monate
    const totalMins = (month * 30 + day) * 24 * 60 + hours * 60 + minutes;
    return totalMins;
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

  // E-Mail Differenz Berechnung ausführen
  const calculateEmailDifference = (emailStr, orderStr) => {
    setEmailErrorMsg('');
    const emailMin = parseDateTimeToMinutes(emailStr);
    const orderMin = parseDateTimeToMinutes(orderStr);

    if (emailMin === null || orderMin === null) {
      setEmailResult(null);
      return;
    }

    let diffMin = orderMin - emailMin;
    if (diffMin < 0) {
      setEmailErrorMsg('Hinweis: Auftragszeit liegt vor der E-Mail-Ankunft.');
    }

    const absDiff = Math.abs(diffMin);
    const diffHours = Math.floor(absDiff / 60);
    const diffMins = absDiff % 60;

    setEmailResult({
      totalMinutes: diffMin,
      formattedDiff: `${diffMin < 0 ? '-' : ''}${diffHours} Std. ${diffMins} Min.`
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

  const handleEmailChange = (text) => {
    const { formatted } = processAndValidateDateTimeInput(text);
    setEmailDateTime(formatted);

    const rawCleaned = text.replace(/[^0-9]/g, '');
    if (rawCleaned.length === 8) {
      setTimeout(() => {
        orderInputRef.current?.focus();
      }, 50);
    }

    if (formatted.length === 11 && orderDateTime.length === 11) {
      calculateEmailDifference(formatted, orderDateTime);
    } else {
      setEmailResult(null);
    }
  };

  const handleOrderChange = (text) => {
    const { formatted } = processAndValidateDateTimeInput(text);
    setOrderDateTime(formatted);

    if (emailDateTime.length === 11 && formatted.length === 11) {
      calculateEmailDifference(emailDateTime, formatted);
    } else {
      setEmailResult(null);
    }
  };

  const clearInputs = () => {
    setStartTime('');
    setEndTime('');
    setResult(null);
    setErrorMsg('');
  };

  const clearEmailInputs = () => {
    setEmailDateTime('');
    setOrderDateTime('');
    setEmailResult(null);
    setEmailErrorMsg('');
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

        {/* TAB NAVIGATION (3 Tabs) */}
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
              ÜBERSTUNDENRECHNER
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
              activeTab === 'emailCalc' && { backgroundColor: theme.primary, borderColor: theme.primary }
            ]}
            onPress={() => setActiveTab('emailCalc')}
          >
            <Text
              style={[
                styles.tabButtonText,
                { color: theme.textColor },
                activeTab === 'emailCalc' && { color: isDarkMode ? '#090d16' : '#ffffff', fontWeight: '900' }
              ]}
            >
              E-MAIL RECHNER
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

        {/* TAB 1: ÜBERSTUNDENRECHNER */}
        {activeTab === 'calc' ? (
          <View style={styles.calcViewWrapper}>
            
            {/* EINGABE ZEITEN */}
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
                    onSubmitEditing={() => calculateOvertimeWithParams(startTime, endTime, aircraftType)}
                  />
                </View>

              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primary }]} onPress={() => calculateOvertimeWithParams(startTime, endTime, aircraftType)}>
                  <Text style={[styles.actionButtonText, { color: isDarkMode ? '#090d16' : '#ffffff' }]}>BERECHNEN</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.inputBg, borderColor: theme.borderColor, borderWidth: 1 }]} onPress={clearInputs}>
                  <Text style={[styles.actionButtonText, { color: theme.subTextColor }]}>RESET</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* FLUGZEUGTYP SELEKTOR */}
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
        ) : activeTab === 'emailCalc' ? (
          /* TAB 2: E-MAIL RECHNER */
          <View style={styles.calcViewWrapper}>
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.cardLabel, { color: theme.primary }]}>ZEITDIFFERENZ ERFASSEN (TT.MM. HH:MM)</Text>
              
              {emailErrorMsg ? <Text style={[styles.errorText, { color: theme.errorColor }]}>{emailErrorMsg}</Text> : null}

              <View style={styles.emailInputSection}>
                <View style={styles.emailInputWrapper}>
                  <Text style={[styles.inputSubLabel, { color: theme.subTextColor }]}>ANKUNFT E-MAIL</Text>
                  <TextInput
                    ref={emailInputRef}
                    style={[styles.timeInput, { backgroundColor: theme.inputBg, borderColor: theme.borderColor, color: theme.textColor, fontSize: 16 }]}
                    value={emailDateTime}
                    onChangeText={handleEmailChange}
                    placeholder="24.05. 08:00"
                    placeholderTextColor={theme.placeholderColor}
                    keyboardType="numeric"
                    maxLength={11}
                    returnKeyType="next"
                    onSubmitEditing={() => orderInputRef.current?.focus()}
                  />
                </View>

                <View style={styles.emailInputWrapper}>
                  <Text style={[styles.inputSubLabel, { color: theme.subTextColor }]}>AUFTRAGSZEIT</Text>
                  <TextInput
                    ref={orderInputRef}
                    style={[styles.timeInput, { backgroundColor: theme.inputBg, borderColor: theme.borderColor, color: theme.textColor, fontSize: 16 }]}
                    value={orderDateTime}
                    onChangeText={handleOrderChange}
                    placeholder="24.05. 14:30"
                    placeholderTextColor={theme.placeholderColor}
                    keyboardType="numeric"
                    maxLength={11}
                    returnKeyType="done"
                    onSubmitEditing={() => calculateEmailDifference(emailDateTime, orderDateTime)}
                  />
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primary }]} onPress={() => calculateEmailDifference(emailDateTime, orderDateTime)}>
                  <Text style={[styles.actionButtonText, { color: isDarkMode ? '#090d16' : '#ffffff' }]}>DIFFERENZ BERECHNEN</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.inputBg, borderColor: theme.borderColor, borderWidth: 1 }]} onPress={clearEmailInputs}>
                  <Text style={[styles.actionButtonText, { color: theme.subTextColor }]}>RESET</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ERGEBNIS FÜR E-MAIL RECHNER */}
            <View style={[styles.card, styles.resultCard, { backgroundColor: theme.resultBg, borderColor: emailResult ? theme.successColor : theme.borderColor }]}>
              <Text style={[styles.resultTitle, { color: emailResult ? theme.successColor : theme.subTextColor }]}>
                ERGEBNIS ZEITABSTAND
              </Text>

              <View style={[styles.resultHighlight, { backgroundColor: theme.highlightBg, borderColor: emailResult ? theme.successColor : theme.borderColor }]}>
                <Text style={[styles.resultHighlightLabel, { color: emailResult ? theme.successColor : theme.subTextColor }]}>
                  DIFFERENZ ZWISCHEN ANKUNFT & AUFTRAG
                </Text>
                <Text style={[styles.resultHighlightValue, { color: emailResult ? theme.successColor : theme.subTextColor, fontSize: 24 }]}>
                  {emailResult ? emailResult.formattedDiff : '0 Std. 0 Min.'}
                </Text>
                <Text style={[styles.resultHighlightSub, { color: theme.subTextColor }]}>
                  {emailResult ? `Gesamt: ${emailResult.totalMinutes} Minuten` : 'Bitte Datum & Uhrzeit eingeben'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* TAB 3: ANLEITUNG & ENTWICKLERINFO */
          <ScrollView contentContainerStyle={styles.guideScrollContainer} keyboardShouldPersistTaps="handled">
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.cardLabel, { color: theme.primary }]}>HANDBUCH & BEDIENUNG</Text>
              
              <View style={styles.guideStep}>
                <Text style={[styles.guideStepTitle, { color: theme.textColor }]}>1. Überstundenrechner verwenden</Text>
                <Text style={[styles.guideStepDesc, { color: theme.subTextColor }]}>
                  Wechsle in den Tab "Überstundenrechner". Gib dort die Startzeit (STD) und Endzeit (OFB) im Format HH:MM ein. Das System korrigiert ungültige Zeiten (Stunden &gt; 23, Minuten &gt; 59) automatisch und setzt den Cursor bei Bedarf zurück. Wähle anschließend den Flugzeugtyp (B747/A340-600 oder Alle anderen), um die Überstunden in Industriezeit zu berechnen.
                </Text>
              </View>

              <View style={styles.guideStep}>
                <Text style={[styles.guideStepTitle, { color: theme.textColor }]}>2. E-Mail Rechner verwenden</Text>
                <Text style={[styles.guideStepDesc, { color: theme.subTextColor }]}>
                  Im Tab "E-Mail Rechner" kannst du das Datum und die Uhrzeit für die "Ankunft E-Mail" sowie die "Auftragszeit" eingeben (Format: TT.MM. HH:MM). Das Tool errechnet automatisch den zeitlichen Abstand bzw. die Differenz zwischen diesen beiden Zeitpunkten.
                </Text>
              </View>

              <View style={styles.guideStep}>
                <Text style={[styles.guideStepTitle, { color: theme.textColor }]}>3. Allgemeine Berechnungslogik</Text>
                <Text style={[styles.guideStepDesc, { color: theme.subTextColor }]}>
                  Im Überstundenrechner wird ab einer Zeitdifferenz von mehr als 30 Minuten im 15-Minuten-Raster weitergezählt und mit dem flottenabhängigen Faktor multipliziert.
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
    gap: 6,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
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
  emailInputSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  emailInputWrapper: {
    flex: 1,
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
    fontSize: 11,
    letterSpacing: 0.8,
    textAlign: 'center',
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
