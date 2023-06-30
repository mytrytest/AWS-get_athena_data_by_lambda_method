const AWS = require('aws-sdk');

exports.handler = async (event, context) => {
  // AWS SDK configuration
  AWS.config.update({ region: process.env.REGION });

  // Create a new Athena service object
  const athena = new AWS.Athena();

  // Set up the parameters for the Athena API call
  const params = {
    QueryString: 'SELECT * FROM '+process.env.ATHENA_TABLE_NAME+' limit 5',
    ResultConfiguration: {
      OutputLocation: process.env.OUTPUT_S3_BUCKET_PATH
    },
    QueryExecutionContext: {
      Database: process.env.ATHENA_DB_NAME
    }
  };

  try {
    // Start the Athena query execution
    const queryExecution = await athena.startQueryExecution(params).promise();
    const queryExecutionId = queryExecution.QueryExecutionId;

    // Check the status of the query execution
    let queryExecutionStatus = '';
    while (queryExecutionStatus !== 'SUCCEEDED') {
      const queryStatus = await athena.getQueryExecution({ QueryExecutionId: queryExecutionId }).promise();
      queryExecutionStatus = queryStatus.QueryExecution.Status.State;
      if (queryExecutionStatus === 'FAILED' || queryExecutionStatus === 'CANCELLED') {
        throw new Error(`Query execution failed or was cancelled. Status: ${queryExecutionStatus}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before checking again
    }

    // Get the results of the query execution
    const queryResults = await athena.getQueryResults({ QueryExecutionId: queryExecutionId }).promise();

    // Process and return the results
    const results = parseAthenaResults(queryResults);
    return results;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

function parseAthenaResults(queryResults) {
  const rows = queryResults.ResultSet.Rows;
  const columns = rows[0].Data.map(data => data.VarCharValue);
  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].Data;
    const result = {};
    for (let j = 0; j < columns.length; j++) {
      result[columns[j]] = row[j].VarCharValue;
    }
    results.push(result);
  }
  return results;
}
