import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock(
  'react-router-dom',
  () => {
    // Lightweight test doubles so App can render in Jest without router internals.
    const React = require('react');

    return {
      BrowserRouter: ({ children }) => <div>{children}</div>,
      Routes: ({ children }) => <div>{children}</div>,
      Route: ({ element }) => element,
      NavLink: ({ children, to, className, ...props }) => {
        const resolvedClassName =
          typeof className === 'function' ? className({ isActive: false }) : className;

        return (
          <a href={to} className={resolvedClassName} {...props}>
            {children}
          </a>
        );
      },
      Link: ({ children, to, ...props }) => (
        <a href={to} {...props}>
          {children}
        </a>
      ),
    };
  },
  { virtual: true }
);

test('renders home hero heading', () => {
  render(<App />);
  const heading = screen.getByRole('heading', {
    name: /Trade, test, and level up without risking real capital/i,
  });
  expect(heading).toBeInTheDocument();
});
