// ========================================
// EDIT #2: ADD THESE LINES TO APP.TSX  
// ========================================
// Location: After line 202 (after the /invoicing route's closing } />)
// Add these 5 lines:

                    <Route path="/estimates" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <Estimates />
                      </ProtectedRoute>
                    } />

// That's it for Edit #2!
// ========================================
