
const COGNITO_REGION = process.env.COGNITO_REGION || 'us-east-1'

const endpoint = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`

export const getCognitoUserFromAccessToken = async (accessToken) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.GetUser',
    },
    body: JSON.stringify({ AccessToken: accessToken }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.message || data?.Message || 'No se pudo validar el token de Cognito')
  }

  const attrs = Object.fromEntries((data.UserAttributes || []).map((attr) => [attr.Name, attr.Value]))
  return {
    username: data.Username,
    sub: attrs.sub || data.Username,
    phone: attrs.phone_number || '',
    email: attrs.email || '',
    attributes: attrs,
  }
}
