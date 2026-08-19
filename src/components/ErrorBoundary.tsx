import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

// A last-resort screen for JavaScript errors.
//
// Without this, an uncaught render error in a release build unmounts the whole tree and the
// app just disappears — indistinguishable from a native crash, and impossible to report. With
// it, a JS error becomes a readable, selectable message. That distinction is the point: if a
// failure still kills the app *without* showing this screen, the fault is native (a module,
// the camera session, an out-of-memory) and the device log is the only place it will appear.
//
// Deliberately styled without `useSkin` or the bundled fonts — this has to render even when
// the thing that broke is the theme or the font loader.

type Props = { children: ReactNode };
type State = { error: Error | null; componentStack: string | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error('[ErrorBoundary] uncaught error', error, info.componentStack);
  }

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>SOMETHING BROKE</Text>
          <Text style={styles.title}>Daily Pull hit an error</Text>
          <Text style={styles.body}>
            Your cards are safe — this is a display error, not data loss. The details below are what
            is needed to fix it.
          </Text>

          <Text style={styles.sectionLabel}>MESSAGE</Text>
          <Text style={styles.code} selectable>
            {error.message || String(error)}
          </Text>

          {error.stack && (
            <>
              <Text style={styles.sectionLabel}>STACK</Text>
              <Text style={styles.code} selectable>
                {error.stack.split('\n').slice(0, 12).join('\n')}
              </Text>
            </>
          )}

          {componentStack && (
            <>
              <Text style={styles.sectionLabel}>COMPONENT</Text>
              <Text style={styles.code} selectable>
                {componentStack.split('\n').slice(0, 10).join('\n')}
              </Text>
            </>
          )}

          <Text style={styles.footnote}>
            {Platform.OS} · restart the app to continue
          </Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#17130F',
  },
  content: {
    padding: 24,
    paddingTop: 72,
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: '#E0A32E',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F4ECDC',
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(244,236,220,0.6)',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: 'rgba(244,236,220,0.45)',
    marginTop: 14,
  },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    lineHeight: 16,
    color: '#F4ECDC',
    backgroundColor: 'rgba(244,236,220,0.06)',
    borderRadius: 8,
    padding: 12,
  },
  footnote: {
    fontSize: 11,
    color: 'rgba(244,236,220,0.4)',
    marginTop: 24,
  },
});
