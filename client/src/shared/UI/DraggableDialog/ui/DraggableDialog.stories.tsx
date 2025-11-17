import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { DraggableDialog } from './DraggabelDialog';

const meta = {
  title: 'shared/DraggableDialog',
  component: DraggableDialog,
  args: {
    title: 'Sample Dialog',
    children: (
      <div>
        <h3>Dialog Content</h3>
        <p>This is a draggable and resizable dialog. You can:</p>
        <ul>
          <li>Drag the header to move the dialog</li>
          <li>Resize from any side or corner</li>
          <li>Interact with the content inside</li>
        </ul>
        <button style={{ padding: '8px 16px', marginTop: '16px' }}>Action Button</button>
      </div>
    ),
  },
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A highly flexible draggable and resizable dialog component. Features include: draggable header, resize handles on all sides and corners, optional header visibility, custom grab areas (top/bottom/left/right), and optional resizing. All position and size props are optional with sensible defaults.',
      },
    },
  },
} satisfies Meta<typeof DraggableDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    initialXPos: 100,
    initialYPos: 100,
    initialWidth: 400,
    initialHeight: 300,
  },
};

export const MinimalUsage: Story = {
  args: {
    children: (
      <div>
        <h3>Minimal Dialog</h3>
        <p>This dialog only uses the required `children` prop!</p>
        <p>All position and size values are using defaults:</p>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>Position: (100, 100)</li>
          <li>Size: 400px × 300px</li>
          <li>Title: "Dialog"</li>
        </ul>
        <p style={{ fontSize: '12px', color: '#666' }}>
          This demonstrates how easy it is to use the component with just content.
        </p>
      </div>
    ),
  },
};

export const WithCloseButton: Story = {
  args: {
    onClose: action('close-clicked'),
    title: 'Dialog with Close Button',
    children: (
      <div>
        <h3>Closeable Dialog</h3>
        <p>This dialog has a close button in the header. Click the × button to close it.</p>
        <p>The close action will be logged in the Actions panel.</p>
      </div>
    ),
  },
};

export const LargeDialog: Story = {
  args: {
    initialWidth: 600,
    initialHeight: 500,
    initialXPos: 50,
    initialYPos: 50,
    title: 'Large Dialog',
    onClose: action('large-dialog-closed'),
    children: (
      <div>
        <h2>Large Dialog Content</h2>
        <p>This is a larger dialog to demonstrate different sizing options.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px' }}>
          <div>
            <h4>Left Column</h4>
            <p>Content in the left column with some text that wraps.</p>
            <input type='text' placeholder='Input field' style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <h4>Right Column</h4>
            <p>Content in the right column.</p>
            <textarea placeholder='Textarea example' style={{ width: '100%', height: '80px', padding: '8px' }} />
          </div>
        </div>
      </div>
    ),
  },
};

export const FormDialog: Story = {
  args: {
    initialWidth: 450,
    initialHeight: 400,
    initialXPos: 200,
    initialYPos: 150,
    title: 'User Information Form',
    onClose: action('form-dialog-closed'),
    children: (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action('form-submitted')();
        }}>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor='name' style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            Name:
          </label>
          <input
            type='text'
            id='name'
            placeholder='Enter your name'
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor='email' style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            Email:
          </label>
          <input
            type='email'
            id='email'
            placeholder='Enter your email'
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor='message' style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            Message:
          </label>
          <textarea
            id='message'
            placeholder='Enter your message'
            rows={4}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type='button'
            onClick={() => action('form-cancelled')()}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer',
            }}>
            Cancel
          </button>
          <button
            type='submit'
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              background: '#007bff',
              color: 'white',
              cursor: 'pointer',
            }}>
            Submit
          </button>
        </div>
      </form>
    ),
  },
};

export const SmallDialog: Story = {
  args: {
    initialWidth: 250,
    initialHeight: 180,
    initialXPos: 300,
    initialYPos: 200,
    title: 'Small Dialog',
    children: (
      <div>
        <p>This is a small dialog demonstrating the minimum size constraints.</p>
        <p style={{ fontSize: '12px', color: '#666' }}>Try resizing - it won't go below 200px width or 150px height.</p>
      </div>
    ),
  },
};

export const CustomPosition: Story = {
  args: {
    initialXPos: 400,
    initialYPos: 300,
    initialWidth: 350,
    initialHeight: 250,
    title: 'Custom Positioned Dialog',
    onClose: action('custom-dialog-closed'),
    children: (
      <div>
        <h3>Custom Position</h3>
        <p>This dialog starts at position (400, 300) to demonstrate custom positioning.</p>
        <p>You can drag it around and resize it from any edge or corner.</p>
        <div style={{ marginTop: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '4px' }}>
          <strong>Tip:</strong> Look for the cursor changes when hovering over the edges and corners!
        </div>
      </div>
    ),
  },
};

export const DefaultValues: Story = {
  args: {
    title: 'Using Default Values',
    children: (
      <div>
        <h3>Default Values Demonstration</h3>
        <p>This story shows what happens when you don't specify position and size props:</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Property</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Default Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>initialXPos</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>100px</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>initialYPos</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>100px</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>initialWidth</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>400px</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>initialHeight</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>300px</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
          Only the `children` prop is required - all others are optional!
        </p>
      </div>
    ),
  },
};

export const HiddenHeader: Story = {
  args: {
    showHeader: false,
    initialXPos: 150,
    initialYPos: 150,
    initialWidth: 350,
    initialHeight: 200,
    children: (
      <div style={{ padding: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0' }}>No Header Dialog</h3>
        <p>This dialog has no header - the title bar is completely hidden.</p>
        <p>
          <strong>Note:</strong> Without a header, you cannot drag this dialog unless grab areas are specified!
        </p>
        <div
          style={{ marginTop: '16px', padding: '12px', background: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeaa7' }}>
          <strong>⚠️ Warning:</strong> This dialog cannot be moved because it has no header and no grab areas.
        </div>
      </div>
    ),
  },
};

export const TopGrabArea: Story = {
  args: {
    showHeader: false,
    grabAreas: ['top'],
    initialXPos: 200,
    initialYPos: 100,
    initialWidth: 400,
    initialHeight: 250,
    resizable: false,
    children: (
      <div style={{ padding: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0' }}>Top Grab Area</h3>
        <p>This dialog can be dragged from the top edge (8px high invisible area).</p>
        <div style={{ background: '#e3f2fd', padding: '12px', borderRadius: '4px', marginTop: '16px' }}>
          <strong>💡 Try this:</strong> Hover over the very top edge of this dialog to see the grab cursor, then drag it!
        </div>
        <p style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>
          The grab area will show a blue highlight when you hover over it.
        </p>
      </div>
    ),
  },
};

export const BottomGrabArea: Story = {
  args: {
    showHeader: false,
    grabAreas: ['bottom'],
    initialXPos: 250,
    initialYPos: 200,
    initialWidth: 400,
    initialHeight: 220,
    resizable: false,
    children: (
      <div style={{ padding: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0' }}>Bottom Grab Area</h3>
        <p>This dialog can be dragged from the bottom edge.</p>
        <div style={{ background: '#f3e5f5', padding: '12px', borderRadius: '4px', marginTop: '16px' }}>
          <strong>💡 Try this:</strong> Hover over the very bottom edge and drag!
        </div>
      </div>
    ),
  },
};

export const SideGrabAreas: Story = {
  args: {
    showHeader: false,
    grabAreas: ['left', 'right'],
    initialXPos: 300,
    initialYPos: 150,
    initialWidth: 350,
    initialHeight: 280,
    resizable: false,
    children: (
      <div style={{ padding: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0' }}>Left & Right Grab Areas</h3>
        <p>This dialog can be dragged from either the left or right edges.</p>
        <div style={{ background: '#e8f5e8', padding: '12px', borderRadius: '4px', marginTop: '16px' }}>
          <strong>💡 Try this:</strong> Hover over the left or right edges to grab and drag!
        </div>
        <p style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>
          Notice how the cursor changes to a grab hand when you hover over the edges.
        </p>
      </div>
    ),
  },
};

export const AllGrabAreas: Story = {
  args: {
    showHeader: false,
    grabAreas: ['top', 'bottom', 'left', 'right'],
    initialXPos: 350,
    initialYPos: 200,
    initialWidth: 380,
    initialHeight: 300,
    resizable: false,
    children: (
      <div style={{ padding: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0' }}>All Grab Areas</h3>
        <p>This dialog can be dragged from any edge - top, bottom, left, or right!</p>
        <div
          style={{ background: '#fff9c4', padding: '12px', borderRadius: '4px', marginTop: '16px', border: '1px solid #ffd54f' }}>
          <strong>🎯 Perfect for:</strong> Floating toolbars, minimal UI panels, or any interface where you want maximum drag
          flexibility.
        </div>
        <p style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>
          Move your mouse around the edges to see all the grab areas in action!
        </p>
      </div>
    ),
  },
};

export const FloatingToolbar: Story = {
  args: {
    showHeader: false,
    grabAreas: ['top'],
    initialXPos: 100,
    initialYPos: 50,
    initialWidth: 500,
    initialHeight: 80,
    resizable: false,
    children: (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          height: '100%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          margin: '-16px',
        }}>
        {['✏️', '🎨', '📐', '🔍', '💾'].map((icon) => (
          <button
            key={icon}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '8px',
              width: '48px',
              height: '48px',
              fontSize: '20px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.transform = 'scale(1)';
            }}>
            {icon}
          </button>
        ))}
      </div>
    ),
  },
};

export const NoResizeWithGrabAreas: Story = {
  args: {
    showHeader: false,
    grabAreas: ['top', 'bottom'],
    initialXPos: 400,
    initialYPos: 100,
    initialWidth: 300,
    initialHeight: 400,
    resizable: false,
    children: (
      <div style={{ padding: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0' }}>Fixed Size Panel</h3>
        <p>This panel demonstrates a common use case:</p>
        <ul style={{ paddingLeft: '20px', margin: '16px 0' }}>
          <li>No header (clean look)</li>
          <li>No resizing (fixed size)</li>
          <li>Grab areas for movement</li>
        </ul>
        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginTop: '20px' }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Perfect for:</h4>
          <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '14px' }}>
            <li>Tool palettes</li>
            <li>Inspector panels</li>
            <li>Mini dashboards</li>
            <li>Floating controls</li>
          </ul>
        </div>
        <p style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>Drag from top or bottom edges to reposition.</p>
      </div>
    ),
  },
};

export const AutoSizeToContent: Story = {
  args: {
    showHeader: false,
    grabAreas: ['top'],
    initialXPos: 150,
    initialYPos: 250,
    resizable: false,
    // No initialWidth or initialHeight specified - will auto-size to content
    children: (
      <div style={{ padding: '12px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Auto-sized Dialog</h4>
        <p style={{ margin: '0', fontSize: '14px' }}>This dialog automatically sizes to fit its content!</p>
      </div>
    ),
  },
};

export const AutoSizeComplex: Story = {
  args: {
    title: 'Auto-sized Content',
    initialXPos: 300,
    initialYPos: 300,
    resizable: false,
    onClose: action('auto-size-dialog-closed'),
    // No initialWidth or initialHeight specified - will auto-size to content
    children: (
      <div>
        <h3 style={{ margin: '0 0 16px 0' }}>Complex Auto-sized Content</h3>
        <p>This dialog demonstrates auto-sizing with more complex content:</p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <div style={{ background: '#e3f2fd', padding: '12px', borderRadius: '6px', flex: 1 }}>
            <strong>Feature:</strong> Content determines size
          </div>
          <div style={{ background: '#e8f5e8', padding: '12px', borderRadius: '6px', flex: 1 }}>
            <strong>Benefit:</strong> No wasted space
          </div>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
          <button style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', background: 'white' }}>
            Cancel
          </button>
          <button style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', background: '#007bff', color: 'white' }}>
            Confirm
          </button>
        </div>
      </div>
    ),
  },
};

export const AutoSizeMinimal: Story = {
  args: {
    showHeader: false,
    grabAreas: ['left', 'right'],
    initialXPos: 500,
    initialYPos: 150,
    resizable: false,
    // No initialWidth or initialHeight specified - will auto-size to content
    children: (
      <div style={{ padding: '8px 12px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px' }}>
        <span style={{ fontSize: '14px', fontWeight: '500' }}>🔧 Quick Tool</span>
      </div>
    ),
  },
};
