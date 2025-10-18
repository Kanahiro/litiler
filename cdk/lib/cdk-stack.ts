import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class CdkStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		const pmtilesBucket = new cdk.aws_s3.Bucket(this, 'PmtilesBucket', {
			removalPolicy: cdk.RemovalPolicy.DESTROY,
			autoDeleteObjects: true,
		});

		const nodejsFunction = new cdk.aws_lambda_nodejs.NodejsFunction(
			this,
			'NodejsFunction',
			{
				runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
				entry: '../src/index.ts',
				handler: 'handler',
				architecture: cdk.aws_lambda.Architecture.ARM_64,
				environment: {
					LITILER_S3_BUCKET: pmtilesBucket.bucketName,
					LITILER_S3_REGION: this.region,
				},
				timeout: cdk.Duration.seconds(15),
			},
		);

		// LambdaはS3にあるPMTilesを読む
		pmtilesBucket.grantRead(nodejsFunction);

		const functionUrl = nodejsFunction.addFunctionUrl({
			authType: cdk.aws_lambda.FunctionUrlAuthType.AWS_IAM,
		});

		const distribution = new cdk.aws_cloudfront.Distribution(
			this,
			'Distribution',
			{
				defaultBehavior: {
					origin:
						cdk.aws_cloudfront_origins.FunctionUrlOrigin.withOriginAccessControl(
							functionUrl,
						),
					cachePolicy: cdk.aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
				},
				httpVersion: cdk.aws_cloudfront.HttpVersion.HTTP2_AND_3,
			},
		);

		new cdk.CfnOutput(this, 'DistributionDomainName', {
			value: distribution.domainName,
		});
	}
}
